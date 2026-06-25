import { useState, type FormEvent } from "react";
import type { SortTicketRequest, SortTicketResponse } from "./types";

// In dev, the Vite proxy forwards `/api/*` to the local Express server.
// In production builds we must hit the deployed API directly via VITE_API_BASE,
// otherwise the static site would POST to itself and 404.
const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, "") ?? "";
const API_PATH = `${API_BASE}/api/sort-ticket`;

const SAMPLES: Array<{ label: string; req: SortTicketRequest }> = [
  {
    label: "Wrong transfer (EN)",
    req: {
      ticket_id: "T-001",
      channel: "app",
      locale: "en",
      message: "I sent 5000 taka to a wrong number this morning, please help me get it back",
    },
  },
  {
    label: "Payment failed (EN)",
    req: {
      ticket_id: "T-002",
      channel: "app",
      locale: "en",
      message: "Payment failed but my balance was deducted",
    },
  },
  {
    label: "Phishing (EN)",
    req: {
      ticket_id: "T-003",
      channel: "call_center",
      locale: "en",
      message: "Someone called asking my OTP, is that bKash?",
    },
  },
  {
    label: "Refund (EN)",
    req: {
      ticket_id: "T-004",
      channel: "merchant_portal",
      locale: "en",
      message: "Please refund my last transaction, I changed my mind",
    },
  },
  {
    label: "Wrong transfer (BN)",
    req: {
      ticket_id: "T-005",
      channel: "app",
      locale: "bn",
      message: "আমি ভুলে ৩০০০ টাকা ভুল নম্বরে পাঠিয়ে দিয়েছি, টাকা ফেরত পেতে চাই",
    },
  },
];

const SEVERITY_STYLES: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  medium: "bg-amber-100 text-amber-800 ring-amber-200",
  high: "bg-orange-100 text-orange-800 ring-orange-200",
  critical: "bg-rose-100 text-rose-800 ring-rose-200",
};

const DEPARTMENT_STYLES: Record<string, string> = {
  customer_support: "bg-slate-100 text-slate-800 ring-slate-200",
  dispute_resolution: "bg-indigo-100 text-indigo-800 ring-indigo-200",
  payments_ops: "bg-sky-100 text-sky-800 ring-sky-200",
  fraud_risk: "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200",
};

export default function App() {
  const [ticketId, setTicketId] = useState("T-001");
  const [channel, setChannel] = useState<SortTicketRequest["channel"]>("app");
  const [locale, setLocale] = useState<SortTicketRequest["locale"]>("en");
  const [message, setMessage] = useState(SAMPLES[0]!.req.message);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<SortTicketResponse | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResp(null);
    setLoading(true);
    try {
      const body: SortTicketRequest = {
        ticket_id: ticketId,
        channel,
        locale,
        message,
      };
      const r = await fetch(API_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const text = await r.text();
      let json: SortTicketResponse | { error: string; details?: unknown } | null = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(`non-JSON response (${r.status}): ${text.slice(0, 200)}`);
      }
      if (!r.ok) {
        const detail = json && "details" in json ? JSON.stringify(json.details) : "";
        throw new Error(`${r.status} ${(json as { error?: string })?.error ?? "error"}${detail ? " — " + detail : ""}`);
      }
      setResp(json as SortTicketResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadSample = (s: (typeof SAMPLES)[number]) => {
    setTicketId(s.req.ticket_id);
    setChannel(s.req.channel ?? "app");
    setLocale(s.req.locale ?? "en");
    setMessage(s.req.message);
  };

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">CRM Ticket Sorter</h1>
          <p className="mt-1 text-sm text-slate-600">
            Classify a single customer message into case type, severity, department, and a one-sentence agent summary.
          </p>
        </header>

        <form
          onSubmit={submit}
          className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="block text-xs font-medium text-slate-700">Ticket ID</span>
              <input
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500"
                required
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-700">Channel</span>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as SortTicketRequest["channel"])}
                className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500"
              >
                <option value="app">app</option>
                <option value="sms">sms</option>
                <option value="call_center">call_center</option>
                <option value="merchant_portal">merchant_portal</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-700">Locale</span>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as SortTicketRequest["locale"])}
                className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500"
              >
                <option value="en">en</option>
                <option value="bn">bn</option>
                <option value="mixed">mixed</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="block text-xs font-medium text-slate-700">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500"
              required
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => loadSample(s)}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={loading || message.trim().length === 0}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "Classifying..." : "Sort ticket"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-6 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800 ring-1 ring-rose-200">
            {error}
          </div>
        )}

        {resp && (
          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Classification</h2>
                <p className="text-xs text-slate-500">Ticket {resp.ticket_id}</p>
              </div>
              <span
                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                  SEVERITY_STYLES[resp.severity] ?? "bg-slate-100 text-slate-800 ring-slate-200"
                }`}
              >
                severity: {resp.severity}
              </span>
            </div>

            {resp.human_review_required && (
              <div className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">
                ⚠ Human review required — flagged for an agent to pick up immediately.
              </div>
            )}

            <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Case type</dt>
                <dd className="mt-1 font-mono text-sm text-slate-900">{resp.case_type}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Department</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                      DEPARTMENT_STYLES[resp.department] ?? "bg-slate-100 text-slate-800 ring-slate-200"
                    }`}
                  >
                    {resp.department}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Confidence</dt>
                <dd className="mt-1 font-mono text-sm text-slate-900">
                  {(resp.confidence * 100).toFixed(0)}%
                </dd>
              </div>
            </dl>

            <div className="mt-5">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Agent summary</dt>
              <dd className="mt-1 rounded-md bg-slate-50 p-3 text-sm leading-relaxed text-slate-800 ring-1 ring-slate-200">
                {resp.agent_summary}
              </dd>
            </div>
          </section>
        )}

        <footer className="mt-10 text-center text-xs text-slate-500">
          POST <code className="font-mono">{API_PATH}</code> · GET <code className="font-mono">/health</code>
        </footer>
      </div>
    </div>
  );
}