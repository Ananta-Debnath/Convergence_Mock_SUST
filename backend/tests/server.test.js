import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { PUBLIC_CASES } from '../src/lib/sampleCases.js';

let app;
beforeAll(() => {
  app = createApp();
});

describe('GET /health', () => {
  it('returns { status: "ok" }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns { status: "ok" } on the root path', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('POST /sort-ticket', () => {
  for (const c of PUBLIC_CASES) {
    it(`classifies ${c.id} correctly`, async () => {
      const res = await request(app)
        .post('/sort-ticket')
        .send({ ticket_id: c.ticket_id, message: c.message });
      expect(res.status).toBe(200);
      expect(res.body.ticket_id).toBe(c.ticket_id);
      expect(res.body.case_type).toBe(c.expected.case_type);
      expect(res.body.severity).toBe(c.expected.severity);
      expect(res.body.department).toBe(c.expected.department);
      if (c.expected.human_review_required !== undefined) {
        expect(res.body.human_review_required).toBe(
          c.expected.human_review_required,
        );
      }
      expect(typeof res.body.agent_summary).toBe('string');
      expect(res.body.agent_summary.length).toBeGreaterThan(0);
      expect(res.body.confidence).toBeGreaterThan(0);
      expect(res.body.confidence).toBeLessThanOrEqual(1);
    });
  }

  it('rejects missing ticket_id with 400', async () => {
    const res = await request(app)
      .post('/sort-ticket')
      .send({ message: 'hello' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it('rejects missing message with 400', async () => {
    const res = await request(app)
      .post('/sort-ticket')
      .send({ ticket_id: 'T-X' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_request');
  });

  it('rejects unknown body fields (strict schema)', async () => {
    const res = await request(app)
      .post('/sort-ticket')
      .send({ ticket_id: 'T-X', message: 'hi', evil: true });
    expect(res.status).toBe(400);
  });

  it('never echoes secrets in the summary (phishing + PIN)', async () => {
    const res = await request(app)
      .post('/sort-ticket')
      .send({
        ticket_id: 'T-SAFE',
        message:
          'A caller asked for my PIN 123456 and my OTP 987654 to verify my bkash.',
      });
    expect(res.status).toBe(200);
    expect(res.body.case_type).toBe('phishing_or_social_engineering');
    expect(res.body.human_review_required).toBe(true);
    const s = res.body.agent_summary;
    expect(s).not.toMatch(/\b123456\b/);
    expect(s).not.toMatch(/\b987654\b/);
    expect(s.toLowerCase()).not.toMatch(/\bpin\b/);
    expect(s.toLowerCase()).not.toMatch(/\botp\b/);
  });

  it('returns 404 for unknown paths', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
  });
});
