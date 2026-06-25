// Optional, env-gated LLM fallback. Only loaded when LLM_PROVIDER is set.
// Used only when rules return confidence < 0.6, and the response is parsed
// through the same Zod schema and re-checked by the safety utilities.
//
// Supported providers (case-insensitive):
//   - openai  : OpenAI-style /v1/chat/completions
//   - groq    : OpenAI-compatible Groq endpoint
//   - google  : Google Gemini generateContent (key passed via x-goog-api-key)

import { TicketResponse } from '../schemas/ticket.js';
import { enforceSafety } from '../lib/safety.js';

const OPENAI_COMPAT = {
  openai: { baseUrl: 'https://api.openai.com', path: '/v1/chat/completions' },
  groq: { baseUrl: 'https://api.groq.com', path: '/openai/v1/chat/completions' },
};

const PROVIDERS = {
  ...OPENAI_COMPAT,
  google: { kind: 'gemini' },
};

function readEnv() {
  return {
    provider: (process.env.LLM_PROVIDER || '').toLowerCase(),
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || '',
    baseUrl: process.env.LLM_BASE_URL || '',
  };
}

export function isLlmEnabled() {
  const env = readEnv();
  if (!env.provider) return false;
  if (!PROVIDERS[env.provider] && !env.baseUrl) return false;
  if (!env.apiKey) return false;
  if (!env.model) return false;
  return true;
}

const CLASSIFY_SYSTEM_PROMPT = [
  'You are a CRM ticket triage assistant.',
  'Classify the customer message into JSON with fields:',
  'case_type (phishing_or_social_engineering | wrong_transfer | payment_failed | refund_request | other),',
  'severity (low | medium | high | critical),',
  'department (fraud_risk | dispute_resolution | payments_ops | customer_support),',
  'human_review_required (boolean), confidence (0..1), agent_summary (1-2 neutral sentences).',
  'NEVER echo or request PIN, OTP, PAN, CVV, or passwords. Output JSON only.',
].join(' ');

const SUMMARY_SYSTEM_PROMPT = [
  'You are a CRM triage assistant writing a short agent-facing note.',
  'Given the customer message and the assigned routing, produce a single JSON object with one field:',
  'agent_summary — 1-2 neutral sentences that reflect the customer message and the routing decision.',
  'Rules:',
  '- Never include or request PIN, OTP, PAN, CVV, passwords, or long digit runs.',
  '- Do not invent facts not present in the customer message.',
  '- Mention concrete details from the message (amounts, product names, error wording) when available.',
  '- Output JSON only.',
].join(' ');

function buildSummaryUserPrompt({ message, case_type, severity, department }) {
  return [
    'Customer message:',
    '"""',
    message,
    '"""',
    '',
    'Routing:',
    `- case_type: ${case_type}`,
    `- severity: ${severity}`,
    `- department: ${department}`,
  ].join('\n');
}

async function callOpenAiCompat(env, { system, user, json = true }) {
  const cfg = OPENAI_COMPAT[env.provider] || {};
  const baseUrl = env.baseUrl || cfg.baseUrl;
  const path = cfg.path || '/v1/chat/completions';
  const url = `${(baseUrl || '').replace(/\/$/, '')}${path}`;

  const body = {
    model: env.model,
    temperature: 0,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  if (json) body.response_format = { type: 'json_object' };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LLM provider error ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM provider returned no content');
  return json ? JSON.parse(content) : content;
}

async function callGemini(env, { system, user, json = true }) {
  // Default base is Google's public Generative Language endpoint. The
  // model name is appended as a path segment.
  const baseUrl = env.baseUrl || 'https://generativelanguage.googleapis.com';
  const url = `${baseUrl.replace(/\/$/, '')}/v1beta/models/${encodeURIComponent(
    env.model,
  )}:generateContent?key=${encodeURIComponent(env.apiKey)}`;

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LLM provider error ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('LLM provider returned no content');
  // Gemini occasionally wraps the JSON in ```json fences; strip them.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  return json ? JSON.parse(cleaned) : cleaned;
}

async function callLlm(args) {
  const env = readEnv();
  if (env.provider === 'google') {
    return callGemini(env, args);
  }
  return callOpenAiCompat(env, args);
}

// LLM-augmented classification. Caller is responsible for merging with the
// deterministic rules result; this function only ever returns a validated
// response or throws.
export async function classifyWithLlm(message) {
  if (!isLlmEnabled()) {
    throw new Error('LLM fallback is not configured');
  }
  const raw = await callLlm({ system: CLASSIFY_SYSTEM_PROMPT, user: message });
  const parsed = TicketResponse.safeParse({ ...raw, ticket_id: 'pending' });
  if (!parsed.success) {
    throw new Error(`LLM response did not match schema: ${parsed.error.message}`);
  }
  const safety = enforceSafety(parsed.data.agent_summary);
  return {
    ...parsed.data,
    agent_summary: safety.cleaned,
    human_review_required: parsed.data.human_review_required || !safety.safe,
  };
}

// LLM-generated natural-language `agent_summary` for an already-classified
// ticket. Returns a sanitized summary string or throws.
export async function generateSummary(routing) {
  if (!isLlmEnabled()) {
    throw new Error('LLM is not configured');
  }
  const { message, case_type, severity, department } = routing || {};
  if (!message || !case_type || !severity || !department) {
    throw new Error('generateSummary requires { message, case_type, severity, department }');
  }
  const user = buildSummaryUserPrompt({ message, case_type, severity, department });
  const raw = await callLlm({ system: SUMMARY_SYSTEM_PROMPT, user, json: true });
  const summary = typeof raw?.agent_summary === 'string' ? raw.agent_summary : '';
  if (!summary) throw new Error('LLM returned empty agent_summary');
  const safety = enforceSafety(summary);
  return safety.cleaned;
}
