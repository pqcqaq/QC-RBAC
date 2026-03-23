import type { MenuNodeRecord } from '@rbac/api-common';
import { findAffectedUserIdsByPermissionIds } from './rbac';

type MenuAudience = {
  affectsAllCandidates: boolean;
  permissionIds: string[];
};

const collectMenuAudience = (
  nodes: MenuNodeRecord[],
  inheritedPermissionIds: string[] = [],
  permissionIds = new Set<string>(),
): MenuAudience => {
  let affectsAllCandidates = false;

  nodes.forEach((node) => {
    if (node.type === 'DIRECTORY') {
      const nestedAudience = collectMenuAudience(node.children, inheritedPermissionIds, permissionIds);
      if (nestedAudience.affectsAllCandidates) {
        affectsAllCandidates = true;
      }
      return;
    }

    if (node.type === 'PAGE') {
      if (node.permissionId) {
        permissionIds.add(node.permissionId);
        const nestedAudience = collectMenuAudience(node.children, [node.permissionId], permissionIds);
        if (nestedAudience.affectsAllCandidates) {
          affectsAllCandidates = true;
        }
        return;
      }

      affectsAllCandidates = true;
      collectMenuAudience(node.children, [], permissionIds);
      return;
    }

    if (node.permissionId) {
      permissionIds.add(node.permissionId);
      return;
    }

    if (inheritedPermissionIds.length) {
      inheritedPermissionIds.forEach((permissionId) => {
        permissionIds.add(permissionId);
      });
      return;
    }

    affectsAllCandidates = true;
  });

  return {
    affectsAllCandidates,
    permissionIds: [...permissionIds],
  };
};

export const findMenuAffectedUserIds = async (
  nodes: MenuNodeRecord[],
  options: {
    candidateUserIds?: string[];
  } = {},
) => {
  const candidateUserIds = options.candidateUserIds?.length
    ? [...new Set(options.candidateUserIds)]
    : [];

  if (!candidateUserIds.length) {
    return [];
  }

  const audience = collectMenuAudience(nodes);
  if (audience.affectsAllCandidates) {
    return candidateUserIds;
  }

  return findAffectedUserIdsByPermissionIds(audience.permissionIds, {
    restrictToUserIds: candidateUserIds,
  });
};
