'use strict';

const request = require('supertest');
const app = require('../src/app');
const { setupTestDb } = require('./setup');

beforeEach(async () => {
  await setupTestDb();
});

describe('Auth API', () => {
  const user = { name: 'Test User', email: 'test@example.com', password: 'password123' };

  test('POST /api/auth/register – success', async () => {
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(user.email);
  });

  test('POST /api/auth/register – duplicate email returns 409', async () => {
    await request(app).post('/api/auth/register').send(user);
    const res = await request(app).post('/api/auth/register').send(user);
    expect(res.status).toBe(409);
  });

  test('POST /api/auth/register – invalid email returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...user, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/register – short password returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...user, password: 'short' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login – success', async () => {
    await request(app).post('/api/auth/register').send(user);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  test('POST /api/auth/login – wrong password returns 401', async () => {
    await request(app).post('/api/auth/register').send(user);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login – unknown email returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/profile – with token', async () => {
    const reg = await request(app).post('/api/auth/register').send(user);
    const res = await request(app)
      .get('/api/auth/profile')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
  });

  test('GET /api/auth/profile – without token returns 401', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
  });
});
