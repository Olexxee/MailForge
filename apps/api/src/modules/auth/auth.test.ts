import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { hashPassword, hashToken, safeEqual, verifyPassword } from '../../lib/crypto.js';
import { requireCsrf } from './auth.middleware.js';

describe('authentication security primitives', () => {
  it('verifies scrypt password hashes and rejects wrong passwords', async () => {
    const encoded = await hashPassword('a-long-test-password-123');
    expect(await verifyPassword('a-long-test-password-123', encoded)).toBe(true);
    expect(await verifyPassword('wrong-password', encoded)).toBe(false);
  });

  it('stores a one-way digest for opaque tokens', () => {
    expect(hashToken('session-secret')).not.toBe('session-secret');
    expect(hashToken('session-secret')).toBe(hashToken('session-secret'));
    expect(safeEqual('same', 'same')).toBe(true);
    expect(safeEqual('same', 'different')).toBe(false);
  });

  it('rejects missing, mismatched, and invalid CSRF tokens', async () => {
    const app = express();
    app.post('/write', (req, res, next) => {
      res.locals.auth = { csrfTokenHash: hashToken('expected-token') };
      requireCsrf(req, res, next);
    }, (_req, res) => res.sendStatus(204));
    const missing = await request(app).post('/write');
    const mismatch = await request(app).post('/write').set('Cookie', 'mf_csrf=wrong').set('x-csrf-token', 'wrong');
    const valid = await request(app).post('/write').set('Cookie', 'mf_csrf=expected-token').set('x-csrf-token', 'expected-token');
    expect(missing.status).toBe(403);
    expect(mismatch.status).toBe(403);
    expect(valid.status).toBe(204);
  });
});
