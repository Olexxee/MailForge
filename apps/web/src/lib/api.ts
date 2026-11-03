const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

type ApiSuccess<T> = { success: true; data: T; requestId: string };
type ApiFailure = { success: false; error?: { code?: string; message?: string }; requestId?: string };
type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

let csrfToken: string | undefined;

export class ApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export const setCsrfToken = (token: string | undefined) => {
  csrfToken = token;
};

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  const isPublicWrite = path === '/auth/login' || path === '/invitations/accept';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !isPublicWrite) {
    if (!csrfToken) throw new ApiError('Your security token has expired. Reload and sign in again.', 403, 'CSRF_MISSING');
    headers.set('x-csrf-token', csrfToken);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    const failure = payload as ApiFailure;
    throw new ApiError(
      failure.error?.message ?? 'The request could not be completed.',
      response.status,
      failure.error?.code,
    );
  }
  return payload.data;
}

export const bootstrapSession = async () => {
  const csrf = await apiRequest<{ csrfToken: string }>('/auth/csrf');
  setCsrfToken(csrf.csrfToken);
  return apiRequest<{ user: User }>('/auth/me');
};

export interface Membership {
  organisationId: string;
  organisationName: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
}
export interface User {
  id: string;
  email: string;
  displayName: string;
  memberships: Membership[];
}
export interface Organisation {
  id: string;
  name: string;
  slug: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
}
export interface Member {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
  isActive: boolean;
  user: { id: string; email: string; displayName: string };
}
export interface Invitation {
  id: string;
  email: string;
  role: 'ADMIN' | 'STAFF';
  expiresAt: string;
  createdAt: string;
  inviter: { displayName: string };
}
