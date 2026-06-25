// Page composition: header with health dot, two-column layout (form + response).
import { useEffect, useState } from 'react';
import TicketForm from './components/TicketForm.jsx';
import ResponseCard from './components/ResponseCard.jsx';
import { submitTicket, getHealth } from './api/triage.js';

export default function App() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState({ ok: null, checked: false });

  useEffect(() => {
    let cancelled = false;
    getHealth().then((h) => {
      if (!cancelled) setHealth({ ok: h.ok, checked: true });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(payload) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await submitTicket(payload);
      setResult(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setResult(null);
    setError(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">🛡</span>
          <div>
            <h1>SUST CRM Triage</h1>
            <p className="muted small">
              QueueStorm · SUST CSE Carnival 2026 · demo client
            </p>
          </div>
        </div>
        <HealthDot status={health} />
      </header>

      <main className="layout">
        <section className="panel form-panel">
          <h2 className="panel-title">New ticket</h2>
          <TicketForm
            onSubmit={handleSubmit}
            loading={loading}
            lastError={error}
            onClear={handleClear}
          />
        </section>

        <section className="panel response-panel">
          <ResponseCard result={result} />
        </section>
      </main>

      <footer className="app-footer">
        <span className="muted small">
          Calls <code>POST /sort-ticket</code> on the Express backend.
        </span>
      </footer>
    </div>
  );
}

function HealthDot({ status }) {
  if (!status.checked) {
    return (
      <div className="health-dot health-pending" title="Checking backend…">
        <span className="dot" /> Checking…
      </div>
    );
  }
  return (
    <div
      className={`health-dot ${status.ok ? 'health-ok' : 'health-bad'}`}
      title={status.ok ? 'Backend reachable' : 'Backend unreachable'}
    >
      <span className="dot" /> {status.ok ? 'API online' : 'API offline'}
    </div>
  );
}