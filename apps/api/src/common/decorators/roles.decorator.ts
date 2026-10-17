import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../db/schema';

export const ROLES_KEY = 'roles';
/** Restrict a controller or route to the given roles (enforced by RolesGuard). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
