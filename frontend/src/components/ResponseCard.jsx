// Renders the full TicketResponse from POST /sort-ticket.
import { useState } from 'react';
import SeverityChip from './SeverityChip.jsx';

function prettyLabel(s) {
  if (!s) return '';
  return s
    .split('_')
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

function confidencePercent(c) {
  if (c === null || c === undefined || Number.isNaN(Number(c))) return null;
  return Math.round(Math.max(0, Math.min(1, Number(c))) * 100);
}

export default function ResponseCard({ result }) {
  const [copied, setCopied] = useState(false);

  if (!result) {
    return (
      <div className="response-card empty">
        <h2>Routed ticket</h2>
        <p className="muted">
          Submit a ticket to see how the model classifies it. The card will show the
          case type, severity, department, summary, and confidence here.
        </p>
      </div>
    );
  }

  const pct = confidencePercent(result.confidence);
  const review = !!result.human_review_required;

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="response-card">
      <div className="card-header">
        <div>
          <h2>Routed ticket</h2>
          <p className="muted small">
            <code>{result.ticket_id}</code>
          </p>
        </div>
        <button type="button" className="btn ghost small" onClick={copyJson}>
          {copied ? 'Copied!' : 'Copy JSON'}
        </button>
      </div>

      {review && (
        <div className="review-banner" role="status">
          ⚠ Human review required — a human agent should validate this routing before action.
        </div>
      )}

      <dl className="kv">
        <div>
          <dt>Case type</dt>
          <dd>{prettyLabel(result.case_type)}</dd>
        </div>
        <div>
          <dt>Severity</dt>
          <dd>
            <SeverityChip severity={result.severity} />
          </dd>
        </div>
        <div>
          <dt>Department</dt>
          <dd>{prettyLabel(result.department)}</dd>
        </div>
        <div>
          <dt>Human review</dt>
          <dd>
            <span className={`pill ${review ? 'pill-warn' : 'pill-ok'}`}>
              {review ? 'Required' : 'Not required'}
            </span>
          </dd>
        </div>
        <div className="confidence-row">
          <dt>Confidence</dt>
          <dd>
            <div className="confidence">
              <div className="confidence-bar" aria-hidden="true">
                <div
                  className="confidence-fill"
                  style={{ width: `${pct ?? 0}%` }}
                />
              </div>
              <span className="confidence-num">{pct !== null ? `${pct}%` : '—'}</span>
            </div>
          </dd>
        </div>
      </dl>

      <section className="summary">
        <h3>Agent summary</h3>
        <p>{result.agent_summary}</p>
      </section>

      <details className="raw-json">
        <summary>Raw response</summary>
        <pre>{JSON.stringify(result, null, 2)}</pre>
      </details>
    </div>
  );
}