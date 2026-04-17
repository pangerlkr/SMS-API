'use strict';

const request = require('supertest');
const app = require('../src/app');
const { setupTestDb } = require('./setup');

beforeEach(async () => {
  await setupTestDb();
});

describe('Root route', () => {
  test('GET / – returns 200 with HTML content', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('<!DOCTYPE html>');
  });

  test('GET /unknown – returns 404 JSON', async () => {
    const res = await request(app).get('/unknown-route-xyz');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not found');
  });
});
