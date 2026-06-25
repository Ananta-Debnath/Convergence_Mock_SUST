import { useState, type FormEvent } from "react";
import type { SortTicketRequest, SortTicketResponse } from "./types";

// In dev, the Vite proxy forwards `/api/*` to the local Express server.
// In production builds we must hit the deployed API directly via VITE_API_BASE,
// otherwise the static site would POST to itself and 404.
const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, "") ?? "";
const API_PATH = `${API_BASE}/sort-ticket`;

type SampleChannel = NonNullable<SortTicketRequest["channel"]>;

const SAMPLES: Array<{ label: string; channel: SampleChannel; message: string }> = [
  {
    label: "Wrong transfer (EN)",
    channel: "app",
    message: "I sent 5000 taka to a wrong number this morning, please help me get it back",
  },
  {
    label: "Payment failed (EN)",
    channel: "app",
    message: "Payment failed but my balance was deducted",
  },
  {
    label: "Phishing (EN)",
    channel: "call_center",
    message: "Someone called asking my OTP, is that bKash?",
  },
  {
    label: "Refund (EN)",
    channel: "merchant_portal",
    message: "Please refund my last transaction, I changed my mind",
  },
  {
    label: "Wrong transfer (BN)",
    channel: "app",
    message: "আমি ভুলে ৩০০০ টাকা ভুল নম্বরে পাঠিয়ে দিয়েছি, টাকা ফেরত পেতে চাই",
  },
];

// Detect locale from message text by counting Bangla vs Latin characters.
function detectLocale(message: string): "en" | "bn" | "mixed" {
  const bn = (message.match(/[\u0980-\u09FF]/g) || []).length;
  const en = (message.match(/[A-Za-z]/g) || []).length;
  if (bn > 0 && en > 0) return "mixed";
  if (bn > 0) return "bn";
  return "en";
}

// Generate a fresh, short, unique-ish ticket id on the client.
function makeTicketId(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `T-${t}-${r}`;
}

const SEVERITY_DARK: Record<string, string> = {
  low: "bg-emerald-900/60 text-emerald-200 ring-emerald-700",
  medium: "bg-amber-900/60 text-amber-200 ring-amber-700",
  high: "bg-orange-900/60 text-orange-200 ring-orange-700",
  critical: "bg-rose-900/60 text-rose-200 ring-rose-700",
};

const DEPARTMENT_DARK: Record<string, string> = {
  customer_support: "bg-slate-700 text-slate-100 ring-slate-600",
  dispute_resolution: "bg-indigo-900/60 text-indigo-200 ring-indigo-700",
  payments_ops: "bg-sky-900/60 text-sky-200 ring-sky-700",
  fraud_risk: "bg-fuchsia-900/60 text-fuchsia-200 ring-fuchsia-700",
};

export default function App() {
  const [ticketId, setTicketId] = useState(() => makeTicketId());
  const [channel, setChannel] = useState<SortTicketRequest["channel"]>("app");
  const [message, setMessage] = useState(SAMPLES[0]!.message);

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
        locale: detectLocale(message),
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
    setTicketId(makeTicketId());
    setChannel(s.channel);
    setMessage(s.message);
  };

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-50">CRM Ticket Sorter</h1>
          <p className="mt-1 text-sm text-slate-300">
            Classify a single customer message into case type, severity, department, and a one-sentence agent summary.
          </p>
        </header>

        <form
          onSubmit={submit}
          className="rounded-2xl bg-slate-800 p-6 shadow-lg ring-1 ring-slate-700"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs font-medium text-slate-300">Channel</span>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as SortTicketRequest["channel"])}
                className="mt-1 w-full rounded-md border-slate-600 bg-slate-800 text-slate-100 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500"
              >
                <option value="app">app</option>
                <option value="sms">sms</option>
                <option value="call_center">call_center</option>
                <option value="merchant_portal">merchant_portal</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-300">Locale (auto)</span>
              <div className="mt-1 flex h-[38px] items-center rounded-md border border-slate-600 bg-slate-800 px-3 text-sm text-slate-200">
                <span className="font-mono">{detectLocale(message)}</span>
                <span className="ml-2 text-xs text-slate-400">detected from message</span>
              </div>
            </label>
          </div>

          <label className="mt-4 block">
            <span className="block text-xs font-medium text-slate-300">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-md border-slate-600 bg-slate-800 text-slate-100 text-sm shadow-sm focus:border-brand-500 focus:ring-brand-500"
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
                  className="rounded-full bg-slate-700 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-600"
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={loading || message.trim().length === 0}
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-600 disabled:opacity-60"
            >
              {loading ? "Classifying..." : "Sort ticket"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-6 rounded-lg bg-rose-950/60 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-800">
            {error}
          </div>
        )}

        {resp && (
          <section className="mt-8 rounded-2xl bg-slate-800 p-6 shadow-sm ring-1 ring-slate-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Classification</h2>
                <p className="text-xs text-slate-400">Ticket {resp.ticket_id}</p>
              </div>
              <span
                className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${SEVERITY_DARK[resp.severity] ?? "bg-slate-700 text-slate-100 ring-slate-600"}`}
              >
                severity: {resp.severity}
              </span>
            </div>

            {resp.human_review_required && (
              <div className="mt-4 rounded-md bg-rose-950/60 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-800">
                ⚠ Human review required — flagged for an agent to pick up immediately.
              </div>
            )}

            <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Case type</dt>
                <dd className="mt-1 font-mono text-sm text-slate-100">{resp.case_type}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Department</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${DEPARTMENT_DARK[resp.department] ?? "bg-slate-700 text-slate-100 ring-slate-600"}`}
                  >
                    {resp.department}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Confidence</dt>
                <dd className="mt-1 font-mono text-sm text-slate-100">
                  {(resp.confidence * 100).toFixed(0)}%
                </dd>
              </div>
            </dl>

            <div className="mt-5">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Agent summary</dt>
              <dd className="mt-1 rounded-md bg-slate-900/60 p-3 text-sm leading-relaxed text-slate-100 ring-1 ring-slate-700">
                {resp.agent_summary}
              </dd>
            </div>
          </section>
        )}

        <footer className="mt-10 text-center text-xs text-slate-400">
          POST <code className="font-mono text-slate-300">{API_PATH}</code> · GET <code className="font-mono text-slate-300">/health</code>
        </footer>
      </div>
    </div>
  );
}