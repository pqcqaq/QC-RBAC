import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  matchWsTopic,
  normalizeWsPublishTopic,
  normalizeWsSubscriptionTopic,
} from '@rbac/api-common';

describe('realtime topic matcher', () => {
  it('matches exact, single-level, and multi-level subscriptions', () => {
    assert.equal(matchWsTopic('/chat/global/message', '/chat/global/message'), true);
    assert.equal(matchWsTopic('/system/users/123/rbac-updated', '/system/users/+/rbac-updated'), true);
    assert.equal(matchWsTopic('/system/users/123/rbac-updated', '/system/#'), true);
    assert.equal(matchWsTopic('/system/users/123/rbac-updated', '/system/users/+/detail'), false);
    assert.equal(matchWsTopic('/chat/global/message', '/chat/+/message'), true);
    assert.equal(matchWsTopic('/chat/global/message', '/chat/+'), false);
  });

  it('normalizes legal topics and rejects invalid wildcard placement', () => {
    assert.equal(normalizeWsPublishTopic('chat/global/message'), '/chat/global/message');
    assert.equal(normalizeWsSubscriptionTopic('/system//users/+/rbac-updated/'), '/system/users/+/rbac-updated');

    assert.throws(
      () => normalizeWsPublishTopic('/system/#'),
      /cannot contain wildcards/i,
    );
    assert.throws(
      () => normalizeWsSubscriptionTopic('/system/#/detail'),
      /only appear in the last segment/i,
    );
    assert.throws(
      () => normalizeWsSubscriptionTopic('/system/user+detail'),
      /must occupy an entire segment/i,
    );
  });
});
