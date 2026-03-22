import { loadIcons } from '@iconify/vue';

const unoIconNamePattern = /^i-([a-z0-9]+)-(.*)$/i;
const preloadedIconNames = new Set<string>();

export const normalizeIconName = (value?: string | null) => {
  const nextValue = value?.trim();
  if (!nextValue) {
    return '';
  }

  const unoIconMatch = nextValue.match(unoIconNamePattern);
  if (unoIconMatch) {
    return `${unoIconMatch[1]}:${unoIconMatch[2]}`;
  }

  return nextValue.includes(':') ? nextValue : '';
};

export const preloadIconNames = (icons: Array<string | null | undefined>) => {
  const iconNamesToLoad = Array.from(
    new Set(
      icons
        .map((icon) => normalizeIconName(icon))
        .filter((icon): icon is string => Boolean(icon)),
    ),
  ).filter((icon) => !preloadedIconNames.has(icon));

  if (!iconNamesToLoad.length) {
    return;
  }

  iconNamesToLoad.forEach((icon) => preloadedIconNames.add(icon));
  loadIcons(iconNamesToLoad);
};
