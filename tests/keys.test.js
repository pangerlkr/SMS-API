'use strict';

const request = require('supertest');
const app = require('../src/app');
const { setupTestDb } = require('./setup');

let token;

beforeEach(async () => {
  await setupTestDb();
  const res = await request(app).post('/api/auth/register').send({
    name: 'Keys Tester',
    email: 'keys@example.com',
    password: 'password123'
  });
  token = res.body.token;
});

describe('API Keys', () => {
  test('POST /api/keys – creates key', async () => {
    const res = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My App Key' });

    expect(res.status).toBe(201);
    expect(res.body.api_key).toHaveProperty('key_value');
    expect(res.body.api_key.key_value).toMatch(/^smsapi_/);
  });

  test('POST /api/keys – requires name', async () => {
    const res = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('GET /api/keys – lists keys with masked values', async () => {
    await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Key 1' });

    const res = await request(app)
      .get('/api/keys')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.api_keys.length).toBe(1);
    expect(res.body.api_keys[0].key_preview).toMatch(/\.\.\.$/);
  });

  test('DELETE /api/keys/:id – revokes key', async () => {
    const create = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'To Revoke' });

    const keyId = create.body.api_key.id;

    const res = await request(app)
      .delete(`/api/keys/${keyId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  test('DELETE /api/keys/:id – revoked key cannot send SMS', async () => {
    const create = await request(app)
      .post('/api/keys')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'To Revoke' });

    const { id: keyId, key_value } = create.body.api_key;

    await request(app)
      .delete(`/api/keys/${keyId}`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .post('/api/sms/send')
      .set('X-API-Key', key_value)
      .send({ to: '9876543210', message: 'Test' });

    expect(res.status).toBe(401);
  });
});
