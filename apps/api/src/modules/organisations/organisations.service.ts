import { AppError } from '../../lib/http.js';
import { findMembership, findMembershipsForUser, listMembers, updateMembership } from './organisations.db.js';

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

export const changeOrganisationMembership = async (input: {
  organisationId: string; actorId: string; targetUserId: string; role?: 'ADMIN' | 'STAFF'; isActive?: boolean;
}) => {
  const actor = await assertOrganisationRole(input.organisationId, input.actorId, ['OWNER', 'ADMIN']);
  const target = await findMembership(input.organisationId, input.targetUserId);
  if (!target) throw new AppError('MEMBERSHIP_NOT_FOUND', 404, 'Organisation membership was not found');
  if (target.role === 'OWNER') throw new AppError('OWNER_PROTECTED', 409, 'Owner membership cannot be changed through this endpoint');
  if (actor.role === 'ADMIN' && (target.role !== 'STAFF' || input.role === 'ADMIN')) {
    throw new AppError('ACCESS_DENIED', 403, 'Administrators may manage staff members only');
  }
  const updated = await updateMembership(input);
  if (!updated) throw new AppError('MEMBERSHIP_NOT_FOUND', 404, 'Organisation membership was not found');
  return updated;
};
