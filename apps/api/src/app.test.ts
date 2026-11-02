import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { app, AppError, asyncWrapper, errorHandler } from '../app.js';

describe('HTTP foundation', () => {
  it('returns a request id and typed 404 response', async () => {
    const response = await request(app).get('/unknown');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  it('forwards async failures and hides internal error details', async () => {
    const testApp = express();
    testApp.use((_req, res, next) => { res.locals.requestId = 'test-request'; next(); });
    testApp.get('/failure', asyncWrapper(() => { throw new Error('private stack detail'); }));
    testApp.use(errorHandler);
    const response = await request(testApp).get('/failure');
    expect(response.status).toBe(500);
    expect(response.text).not.toContain('private stack detail');
  });

  it('serialises typed application errors', async () => {
    const testApp = express();
    testApp.use((_req, res, next) => { res.locals.requestId = 'test-request'; next(); });
    testApp.get('/denied', (_req, _res, next) => next(new AppError('ACCESS_DENIED', 403, 'Forbidden')));
    testApp.use(errorHandler);
    const response = await request(testApp).get('/denied');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('ACCESS_DENIED');
  });
});
