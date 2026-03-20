import type { RequestHandler } from 'express';
import type { PermissionCode } from '@rbac/api-common';
import { forbidden } from '../utils/errors.js';

export const requirePermission = (permission: PermissionCode | string): RequestHandler => {
  return (req, _res, next) => {
    if (!req.auth?.permissions.includes(permission)) {
      next(forbidden(`Missing permission: ${permission}`));
      return;
    }
    next();
  };
};

export const requireAnyPermission = (...permissions: Array<PermissionCode | string>): RequestHandler => {
  return (req, _res, next) => {
    if (!permissions.some(permission => req.auth?.permissions.includes(permission))) {
      next(forbidden(`Missing one of permissions: ${permissions.join(', ')}`));
      return;
    }
    next();
  };
};
