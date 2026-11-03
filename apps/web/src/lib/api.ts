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

const parseResponse = async <T>(response: Response): Promise<ApiEnvelope<T>> => {
  const raw = await response.text();
  try {
    return JSON.parse(raw) as ApiEnvelope<T>;
  } catch {
    throw new ApiError('The server returned an unreadable response.', response.status);
  }
};

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  const isPublicWrite = path === '/auth/login' || path === '/invitations/accept';
  if (isWrite && !isPublicWrite && !csrfToken) {
    throw new ApiError('Your security token is missing. Reload and sign in again.', 403, 'CSRF_MISSING');
  }

  const send = async () => {
    const headers = new Headers({ Accept: 'application/json' });
    if (options.body !== undefined) headers.set('Content-Type', 'application/json');
    if (isWrite && !isPublicWrite && csrfToken) headers.set('x-csrf-token', csrfToken);
    return fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers,
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  };

  let response = await send();
  let payload = await parseResponse<T>(response);
  if (
    !response.ok &&
    isWrite &&
    !isPublicWrite &&
    (payload as ApiFailure).error?.code === 'CSRF_INVALID'
  ) {
    const renewalResponse = await fetch(`${API_BASE}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    const renewal = await parseResponse<{ csrfToken: string }>(renewalResponse);
    if (!renewalResponse.ok || !renewal.success) {
      throw new ApiError('Your session has expired. Sign in again.', renewalResponse.status, 'SESSION_EXPIRED');
    }
    setCsrfToken(renewal.data.csrfToken);
    response = await send();
    payload = await parseResponse<T>(response);
  }

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


export async function apiDownload(path: string, filename: string): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/octet-stream' },
  });
  if (!response.ok) {
    const payload = await parseResponse<unknown>(response);
    const failure = payload as ApiFailure;
    throw new ApiError(
      failure.error?.message ?? 'The attachment could not be downloaded.',
      response.status,
      failure.error?.code,
    );
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = Array.from(filename, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 || code === 47 || code === 92 ? '_' : character;
  }).join('').slice(0, 180) || 'attachment';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
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
