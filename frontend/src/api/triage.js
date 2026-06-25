// Thin client for the triage API.
// `VITE_API_BASE` defaults to `/api`, which the Vite dev proxy forwards
// to http://localhost:3000 (see `vite.config.js`).
//
// Custom `ApiError` carries the server's JSON body so the form can render
// Zod `details[]` and `error` codes without re-parsing.

const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

export async function submitTicket({ ticket_id, message, channel, locale }) {
  const body = {
    ticket_id,
    message,
    channel: channel || 'app',
    locale: locale || 'en-BD',
  };

  let res;
  try {
    res = await fetch(`${API_BASE}/sort-ticket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new ApiError(`Network error: ${err.message}`, { status: 0, code: 'network_error' });
  }

  const payload = await parseJsonSafe(res);

  if (!res.ok) {
    throw new ApiError(payload.error || `HTTP ${res.status}`, {
      status: res.status,
      code: payload.error,
      details: payload.details,
    });
  }

  return payload;
}

export async function getHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const payload = await parseJsonSafe(res);
    if (!res.ok || payload.status !== 'ok') return { ok: false };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function makeTicketId() {
  return `T-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}