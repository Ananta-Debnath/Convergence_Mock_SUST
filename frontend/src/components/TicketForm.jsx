// Controlled form: ticket_id (auto) + free-form customer message.
// Emits `onSubmit({ ticket_id, message })` and surfaces ApiError details.
import { useState } from 'react';
import { makeTicketId } from '../api/triage.js';

const MAX_MESSAGE_CHARS = 16000; // backend rejects > 16 KB

export default function TicketForm({ onSubmit, loading, lastError, onClear }) {
  const [ticketId, setTicketId] = useState(() => makeTicketId());
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = message.trim();
  const tooLong = message.length > MAX_MESSAGE_CHARS;
  const canSubmit = !loading && trimmed.length > 0 && !tooLong;

  function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onSubmit({ ticket_id: ticketId.trim(), message: trimmed });
  }

  function handleReset() {
    setTicketId(makeTicketId());
    setMessage('');
    setTouched(false);
    onClear?.();
  }

  const messageInvalid = touched && trimmed.length === 0;

  return (
    <form className="ticket-form" onSubmit={handleSubmit} noValidate>
      <div className="form-row">
        <label htmlFor="ticket-id">Ticket ID</label>
        <input
          id="ticket-id"
          type="text"
          value={ticketId}
          onChange={(e) => setTicketId(e.target.value)}
          maxLength={64}
          spellCheck={false}
        />
      </div>

      <div className="form-row">
        <label htmlFor="message">
          Customer message
          <span className="char-count" aria-live="polite">
            {message.length.toLocaleString()} / {MAX_MESSAGE_CHARS.toLocaleString()}
          </span>
        </label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={8}
          placeholder="Paste or type what the customer said…"
          aria-invalid={messageInvalid || tooLong}
        />
        {messageInvalid && <p className="field-error">Please enter a message.</p>}
        {tooLong && (
          <p className="field-error">
            Message is too long ({message.length.toLocaleString()} chars; max{' '}
            {MAX_MESSAGE_CHARS.toLocaleString()}).
          </p>
        )}
      </div>

      {lastError && <ErrorPanel error={lastError} />}

      <div className="form-actions">
        <button type="submit" className="btn primary" disabled={!canSubmit}>
          {loading ? 'Routing…' : 'Route ticket'}
        </button>
        <button type="button" className="btn ghost" onClick={handleReset}>
          Reset
        </button>
      </div>
    </form>
  );
}

function ErrorPanel({ error }) {
  const status = error?.status;
  const code = error?.code || error?.message || 'unknown_error';
  const details = Array.isArray(error?.details) ? error.details : [];

  let heading = code;
  if (status === 400) heading = 'Invalid request (400)';
  else if (status === 413) heading = 'Payload too large (413)';
  else if (status === 500) heading = 'Server error (500)';
  else if (status === 504) heading = 'Request timed out (504)';
  else if (!status) heading = 'Could not reach the API';

  return (
    <div className="error-panel" role="alert">
      <strong>{heading}</strong>
      {details.length > 0 && (
        <ul className="error-details">
          {details.map((d, i) => (
            <li key={i}>
              <code>{d.path || '(root)'}</code>: {d.message}
            </li>
          ))}
        </ul>
      )}
      {!details.length && error?.message && status !== 0 && (
        <p className="error-message">{error.message}</p>
      )}
      {status === 0 && (
        <p className="error-message">
          Is the backend running on <code>:3000</code>?
        </p>
      )}
    </div>
  );
}