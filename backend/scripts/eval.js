// scripts/eval.js — replay the 5 public sample tickets through the in-process
// Express app (or against a running server if BASE_URL is set) and assert
// the expected case_type/severity/department.

import { createApp } from '../src/app.js';
import { PUBLIC_CASES } from '../src/lib/sampleCases.js';

const BASE_URL = process.env.BASE_URL || '';

async function callSortTicket(body) {
  if (BASE_URL) {
    const resp = await fetch(`${BASE_URL.replace(/\/$/, '')}/sort-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: resp.status, body: await resp.json() };
  }
  // In-process: use supertest-style against the express handler.
  const { default: supertest } = await import('supertest');
  const app = createApp();
  const res = await supertest(app)
    .post('/sort-ticket')
    .send(body);
  return { status: res.status, body: res.body };
}

function fmt(v) {
  if (v === undefined) return '-';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

async function main() {
  console.log(`\nEval — replaying ${PUBLIC_CASES.length} public cases${BASE_URL ? ` against ${BASE_URL}` : ' (in-process)'}\n`);
  console.log(pad('id', 26), pad('case_type', 38), pad('severity', 10), pad('department', 22), pad('review', 8), pad('conf', 6));
  console.log('-'.repeat(110));

  let failed = 0;
  for (const c of PUBLIC_CASES) {
    const { status, body } = await callSortTicket({
      ticket_id: c.ticket_id,
      message: c.message,
    });
    const okStatus = status === 200;
    const okType = body?.case_type === c.expected.case_type;
    const okSev = body?.severity === c.expected.severity;
    const okDept = body?.department === c.expected.department;
    const okRev =
      c.expected.human_review_required === undefined ||
      body?.human_review_required === c.expected.human_review_required;
    const pass = okStatus && okType && okSev && okDept && okRev;
    if (!pass) failed += 1;

    const tag = pass ? 'PASS' : 'FAIL';
    console.log(
      `[${tag}]`,
      pad(c.id, 22),
      pad(fmt(body?.case_type), 38),
      pad(fmt(body?.severity), 10),
      pad(fmt(body?.department), 22),
      pad(fmt(body?.human_review_required), 8),
      pad(typeof body?.confidence === 'number' ? body.confidence.toFixed(2) : '-', 6),
    );
    if (!pass) {
      console.log('       expected:', JSON.stringify(c.expected));
    }
  }

  console.log('');
  if (failed > 0) {
    console.error(`Eval FAILED: ${failed}/${PUBLIC_CASES.length} cases did not match.`);
    process.exit(1);
  } else {
    console.log(`Eval OK: ${PUBLIC_CASES.length}/${PUBLIC_CASES.length} cases matched.`);
  }
}

main().catch((err) => {
  console.error('eval crashed:', err);
  process.exit(2);
});
