'use strict';

const request = require('supertest');
const app = require('../src/app');
const { setupTestDb } = require('./setup');

let token;
let simCardId;

async function setupUserWithVerifiedSim() {
  const reg = await request(app).post('/api/auth/register').send({
    name: 'Webhook Tester',
    email: 'webhook@example.com',
    password: 'password123'
  });
  token = reg.body.token;

  const simReg = await request(app)
    .post('/api/sim/register')
    .set('Authorization', `Bearer ${token}`)
    .send({ phone_number: '+919876543210', label: 'Test SIM' });

  simCardId = simReg.body.sim_card_id;
  const otp = simReg.body.otp_for_testing;

  await request(app)
    .post('/api/sim/verify')
    .set('Authorization', `Bearer ${token}`)
    .send({ sim_card_id: simCardId, otp });
}

beforeEach(async () => {
  await setupTestDb();
  await setupUserWithVerifiedSim();
});

describe('Webhooks API', () => {
  test('POST /api/webhooks – registers a webhook for a verified SIM', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({ sim_card_id: simCardId, endpoint_url: 'https://example.com/sms' });

    expect(res.status).toBe(201);
    expect(res.body.webhook).toHaveProperty('id');
    expect(res.body.webhook.endpoint_url).toBe('https://example.com/sms');
    expect(res.body.webhook).toHaveProperty('secret');
  });

  test('POST /api/webhooks – auto-generates secret when not provided', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({ sim_card_id: simCardId, endpoint_url: 'https://example.com/sms' });

    expect(res.status).toBe(201);
    expect(res.body.webhook.secret).toBeTruthy();
  });

  test('POST /api/webhooks – accepts a custom secret', async () => {
    const secret = 'mysecret123';
    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({ sim_card_id: simCardId, endpoint_url: 'https://example.com/sms', secret });

    expect(res.status).toBe(201);
    expect(res.body.webhook.secret).toBe(secret);
  });

  test('POST /api/webhooks – rejects a secret shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({ sim_card_id: simCardId, endpoint_url: 'https://example.com/sms', secret: 'short' });

    expect(res.status).toBe(400);
  });

  test('POST /api/webhooks – replaces existing webhook for the same SIM', async () => {
    await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({ sim_card_id: simCardId, endpoint_url: 'https://first.example.com/sms' });

    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({ sim_card_id: simCardId, endpoint_url: 'https://second.example.com/sms' });

    expect(res.status).toBe(201);

    const list = await request(app)
      .get('/api/webhooks')
      .set('Authorization', `Bearer ${token}`);

    expect(list.body.webhooks.length).toBe(1);
    expect(list.body.webhooks[0].endpoint_url).toBe('https://second.example.com/sms');
  });

  test('POST /api/webhooks – rejects unverified SIM', async () => {
    const simReg = await request(app)
      .post('/api/sim/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ phone_number: '+918888888888' });

    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({ sim_card_id: simReg.body.sim_card_id, endpoint_url: 'https://example.com/sms' });

    expect(res.status).toBe(400);
  });

  test('POST /api/webhooks – rejects invalid endpoint URL', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({ sim_card_id: simCardId, endpoint_url: 'not-a-valid-url' });

    expect(res.status).toBe(400);
  });

  test('POST /api/webhooks – rejects missing sim_card_id', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint_url: 'https://example.com/sms' });

    expect(res.status).toBe(400);
  });

  test('POST /api/webhooks – requires authentication', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .send({ sim_card_id: simCardId, endpoint_url: 'https://example.com/sms' });

    expect(res.status).toBe(401);
  });

  test('GET /api/webhooks – lists registered webhooks with SIM phone number', async () => {
    await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({ sim_card_id: simCardId, endpoint_url: 'https://example.com/sms' });

    const res = await request(app)
      .get('/api/webhooks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.webhooks.length).toBe(1);
    expect(res.body.webhooks[0]).toHaveProperty('endpoint_url', 'https://example.com/sms');
    expect(res.body.webhooks[0]).toHaveProperty('phone_number');
    expect(res.body.webhooks[0].active).toBe(1); // 1 = active in SQLite boolean
  });

  test('GET /api/webhooks – returns empty list when no webhooks registered', async () => {
    const res = await request(app)
      .get('/api/webhooks')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.webhooks.length).toBe(0);
  });

  test('GET /api/webhooks – requires authentication', async () => {
    const res = await request(app).get('/api/webhooks');
    expect(res.status).toBe(401);
  });

  test('DELETE /api/webhooks/:id – deletes a webhook', async () => {
    const create = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({ sim_card_id: simCardId, endpoint_url: 'https://example.com/sms' });

    const webhookId = create.body.webhook.id;

    const res = await request(app)
      .delete(`/api/webhooks/${webhookId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);

    const list = await request(app)
      .get('/api/webhooks')
      .set('Authorization', `Bearer ${token}`);

    expect(list.body.webhooks.length).toBe(0);
  });

  test('DELETE /api/webhooks/:id – returns 404 for unknown webhook', async () => {
    const res = await request(app)
      .delete('/api/webhooks/nonexistent-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  test('DELETE /api/webhooks/:id – requires authentication', async () => {
    const res = await request(app).delete('/api/webhooks/some-id');
    expect(res.status).toBe(401);
  });

  test("DELETE /api/webhooks/:id – cannot delete another user's webhook", async () => {
    const create = await request(app)
      .post('/api/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({ sim_card_id: simCardId, endpoint_url: 'https://example.com/sms' });

    const webhookId = create.body.webhook.id;

    // Register a second user
    const reg2 = await request(app).post('/api/auth/register').send({
      name: 'Other User',
      email: 'other@example.com',
      password: 'password123'
    });
    const token2 = reg2.body.token;

    const res = await request(app)
      .delete(`/api/webhooks/${webhookId}`)
      .set('Authorization', `Bearer ${token2}`);

    expect(res.status).toBe(404);
  });
});
