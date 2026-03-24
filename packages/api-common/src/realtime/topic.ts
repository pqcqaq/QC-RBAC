const TOPIC_SEPARATOR = '/';

const normalizeInput = (topic: string) => topic.trim().replace(/\/+/g, TOPIC_SEPARATOR);

const normalizeBaseTopic = (topic: string) => {
  const normalized = normalizeInput(topic);
  if (!normalized) {
    throw new Error('Topic cannot be empty');
  }

  const withLeadingSeparator = normalized.startsWith(TOPIC_SEPARATOR)
    ? normalized
    : `${TOPIC_SEPARATOR}${normalized}`;

  if (withLeadingSeparator === TOPIC_SEPARATOR) {
    return withLeadingSeparator;
  }

  return withLeadingSeparator.endsWith(TOPIC_SEPARATOR)
    ? withLeadingSeparator.slice(0, -1)
    : withLeadingSeparator;
};

const toSegments = (topic: string) => {
  const normalized = normalizeBaseTopic(topic);
  if (normalized === TOPIC_SEPARATOR) {
    return [] as string[];
  }

  return normalized.slice(1).split(TOPIC_SEPARATOR);
};

const assertNoEmptySegments = (segments: string[]) => {
  if (segments.some((segment) => !segment)) {
    throw new Error('Topic contains an empty segment');
  }
};

export const normalizeWsSubscriptionTopic = (topic: string) => {
  const normalized = normalizeBaseTopic(topic);
  const segments = toSegments(normalized);
  assertNoEmptySegments(segments);

  segments.forEach((segment, index) => {
    if (segment.includes('+') && segment !== '+') {
      throw new Error('The "+" wildcard must occupy an entire segment');
    }

    if (segment.includes('#') && segment !== '#') {
      throw new Error('The "#" wildcard must occupy an entire segment');
    }

    if (segment === '#' && index !== segments.length - 1) {
      throw new Error('The "#" wildcard can only appear in the last segment');
    }
  });

  return normalized;
};

export const normalizeWsPublishTopic = (topic: string) => {
  const normalized = normalizeBaseTopic(topic);
  const segments = toSegments(normalized);
  assertNoEmptySegments(segments);

  if (segments.some((segment) => segment === '+' || segment === '#')) {
    throw new Error('Publish topics cannot contain wildcards');
  }

  return normalized;
};

export const dedupeWsSubscriptionTopics = (topics: Iterable<string>) => {
  const normalizedTopics = new Set<string>();
  for (const topic of topics) {
    normalizedTopics.add(normalizeWsSubscriptionTopic(topic));
  }

  return [...normalizedTopics].sort((left, right) => left.localeCompare(right, 'en'));
};

export const sortWsTopics = (topics: Iterable<string>) =>
  [...topics].sort((left, right) => left.localeCompare(right, 'en'));

export const matchWsTopic = (topic: string, subscriptionTopic: string) => {
  const concreteSegments = toSegments(normalizeWsPublishTopic(topic));
  const patternSegments = toSegments(normalizeWsSubscriptionTopic(subscriptionTopic));

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const concreteSegment = concreteSegments[index];

    if (patternSegment === '#') {
      return true;
    }

    if (concreteSegment === undefined) {
      return false;
    }

    if (patternSegment === '+' || patternSegment === concreteSegment) {
      continue;
    }

    return false;
  }

  return concreteSegments.length === patternSegments.length;
};

export const coversWsSubscriptionTopic = (
  coveringSubscriptionTopic: string,
  requestedSubscriptionTopic: string,
) => {
  const coveringSegments = toSegments(normalizeWsSubscriptionTopic(coveringSubscriptionTopic));
  const requestedSegments = toSegments(normalizeWsSubscriptionTopic(requestedSubscriptionTopic));
  const maxLength = Math.max(coveringSegments.length, requestedSegments.length);

  for (let index = 0; index < maxLength; index += 1) {
    const coveringSegment = coveringSegments[index];
    const requestedSegment = requestedSegments[index];

    if (coveringSegment === '#') {
      return true;
    }

    if (requestedSegment === '#') {
      return false;
    }

    if (coveringSegment === undefined || requestedSegment === undefined) {
      return false;
    }

    if (coveringSegment === '+') {
      continue;
    }

    if (requestedSegment === '+') {
      return false;
    }

    if (coveringSegment !== requestedSegment) {
      return false;
    }
  }

  return true;
};
