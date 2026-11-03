import { AppError } from '../../app.js';
import { findMembership, findMembershipsForUser, listMembers } from './organisations.db.js';

export const getMyOrganisations = async (userId: string) => {
  const memberships = await findMembershipsForUser(userId);
  return memberships.map(({ organisation, role }) => ({
    id: organisation.id,
    name: organisation.name,
    slug: organisation.slug,
    role,
  }));
};

export const assertOrganisationRole = async (
  organisationId: string,
  userId: string,
  allowedRoles: Array<'OWNER' | 'ADMIN' | 'STAFF'>,
) => {
  const membership = await findMembership(organisationId, userId);
  if (!membership || !membership.isActive || !allowedRoles.includes(membership.role)) {
    throw new AppError('ACCESS_DENIED', 403, 'You do not have permission to access this organisation');
  }
  return membership;
};

export const getOrganisationMembers = async (organisationId: string, userId: string) => {
  await assertOrganisationRole(organisationId, userId, ['OWNER', 'ADMIN']);
  return listMembers(organisationId);
};
