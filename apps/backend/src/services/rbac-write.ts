import { prismaRaw } from '../lib/prisma';
import { withSnowflakeIds } from '../utils/persistence';
import { getRequestActorId } from '../utils/request-context';

const unique = (values: string[]) => [...new Set(values)];

export const syncUserRoles = async (userId: string, roleIds: string[]) => {
  const actorId = getRequestActorId();
  const nextRoleIds = unique(roleIds);
  const existing = await prismaRaw.userRole.findMany({
    where: { userId },
    select: { id: true, roleId: true, deleteAt: true },
  });

  const existingByRoleId = new Map(existing.map((item) => [item.roleId, item]));
  const removableIds = existing
    .filter((item) => item.deleteAt === null && !nextRoleIds.includes(item.roleId))
    .map((item) => item.id);
  const restorableIds = existing
    .filter((item) => item.deleteAt !== null && nextRoleIds.includes(item.roleId))
    .map((item) => item.id);
  const creatableRoleIds = nextRoleIds.filter((roleId) => !existingByRoleId.has(roleId));

  await prismaRaw.$transaction(async (tx) => {
    if (removableIds.length) {
      await tx.userRole.updateMany({
        where: { id: { in: removableIds }, deleteAt: null },
        data: {
          deleteAt: new Date(),
          updateId: actorId,
        },
      });
    }

    if (restorableIds.length) {
      await tx.userRole.updateMany({
        where: { id: { in: restorableIds } },
        data: {
          deleteAt: null,
          updateId: actorId,
        },
      });
    }

    if (creatableRoleIds.length) {
      await tx.userRole.createMany({
        data: withSnowflakeIds(creatableRoleIds.map((roleId) => ({
          userId,
          roleId,
          createId: actorId,
          updateId: actorId,
        }))),
      });
    }
  });
};

export const syncRolePermissions = async (roleId: string, permissionIds: string[]) => {
  const actorId = getRequestActorId();
  const nextPermissionIds = unique(permissionIds);
  const existing = await prismaRaw.rolePermission.findMany({
    where: { roleId },
    select: { id: true, permissionId: true, deleteAt: true },
  });

  const existingByPermissionId = new Map(existing.map((item) => [item.permissionId, item]));
  const removableIds = existing
    .filter((item) => item.deleteAt === null && !nextPermissionIds.includes(item.permissionId))
    .map((item) => item.id);
  const restorableIds = existing
    .filter((item) => item.deleteAt !== null && nextPermissionIds.includes(item.permissionId))
    .map((item) => item.id);
  const creatablePermissionIds = nextPermissionIds.filter((permissionId) => !existingByPermissionId.has(permissionId));

  await prismaRaw.$transaction(async (tx) => {
    if (removableIds.length) {
      await tx.rolePermission.updateMany({
        where: { id: { in: removableIds }, deleteAt: null },
        data: {
          deleteAt: new Date(),
          updateId: actorId,
        },
      });
    }

    if (restorableIds.length) {
      await tx.rolePermission.updateMany({
        where: { id: { in: restorableIds } },
        data: {
          deleteAt: null,
          updateId: actorId,
        },
      });
    }

    if (creatablePermissionIds.length) {
      await tx.rolePermission.createMany({
        data: withSnowflakeIds(creatablePermissionIds.map((permissionId) => ({
          roleId,
          permissionId,
          createId: actorId,
          updateId: actorId,
        }))),
      });
    }
  });
};

export const softDeleteUser = async (userId: string) => {
  const actorId = getRequestActorId();
  const deleteAt = new Date();

  await prismaRaw.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { id: userId, deleteAt: null },
      data: { deleteAt, updateId: actorId },
    });
    await tx.userRole.updateMany({
      where: { userId, deleteAt: null },
      data: { deleteAt, updateId: actorId },
    });
    await tx.userAuthentication.updateMany({
      where: { userId, deleteAt: null },
      data: { deleteAt, updateId: actorId },
    });
    await tx.refreshToken.updateMany({
      where: { userId, deleteAt: null },
      data: { deleteAt, updateId: actorId },
    });
  });
};

export const softDeleteRole = async (roleId: string) => {
  const actorId = getRequestActorId();
  const deleteAt = new Date();

  await prismaRaw.$transaction(async (tx) => {
    await tx.role.updateMany({
      where: { id: roleId, deleteAt: null },
      data: { deleteAt, updateId: actorId },
    });
    await tx.rolePermission.updateMany({
      where: { roleId, deleteAt: null },
      data: { deleteAt, updateId: actorId },
    });
  });
};

export const softDeletePermission = async (permissionId: string) => {
  const actorId = getRequestActorId();
  const deleteAt = new Date();

  await prismaRaw.$transaction(async (tx) => {
    await tx.menuNode.updateMany({
      where: { permissionId, deleteAt: null },
      data: { permissionId: null, updateId: actorId },
    });
    await tx.rolePermission.updateMany({
      where: { permissionId, deleteAt: null },
      data: { deleteAt, updateId: actorId },
    });
    await tx.permission.updateMany({
      where: { id: permissionId, deleteAt: null },
      data: { deleteAt, updateId: actorId },
    });
  });
};

export const softDeleteAuthClient = async (clientId: string) => {
  const actorId = getRequestActorId();
  const deleteAt = new Date();

  await prismaRaw.$transaction(async (tx) => {
    await tx.authClient.updateMany({
      where: { id: clientId, deleteAt: null },
      data: { deleteAt, updateId: actorId },
    });
    await tx.refreshToken.updateMany({
      where: { clientId, deleteAt: null },
      data: { deleteAt, updateId: actorId },
    });
  });
};
