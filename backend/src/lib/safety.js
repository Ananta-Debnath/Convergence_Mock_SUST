// Safety utilities. The agent_summary must NEVER echo or ask for sensitive
// secrets (PIN/OTP/PAN/CVV/passwords). These helpers are used to:
//   1. detect risky content in a candidate summary, and
//   2. sanitize long digit runs to avoid leaking card-like numbers.

const SECRET_PATTERN =
  /\b(pin|otp|one[-\s]?time|one[-\s]?time\s+password|pan|cvv|cvc|password|passcode)\b/i;

const DIGIT_RUN = /\b\d{4,}\b/g;

// Returns true if the candidate text contains a secret-like phrase.
export function containsSecret(text) {
  if (typeof text !== 'string' || text.length === 0) return false;
  return SECRET_PATTERN.test(text);
}

// Strips 4+ digit runs (potential card numbers) from the given text.
export function sanitizeDigits(text) {
  if (typeof text !== 'string') return text;
  return text.replace(DIGIT_RUN, '[redacted]');
}

// Neutral rephrasings used by the summary template to keep dangerous phrases
// out of the response. Keys are lowercased trigger phrases, values are the
// replacement used inside agent_summary.
const NEUTRAL_PHRASES = {
  pin: 'account credential',
  otp: 'one-time code',
  'one-time code': 'one-time code',
  'one time code': 'one-time code',
  password: 'account credential',
  passcode: 'account credential',
  cvv: 'card security code',
  cvc: 'card security code',
  pan: 'card number',
};

export function neutralize(text) {
  if (typeof text !== 'string') return text;
  let out = text;
  for (const [bad, good] of Object.entries(NEUTRAL_PHRASES)) {
    const re = new RegExp(`\\b${bad}\\b`, 'gi');
    out = out.replace(re, good);
  }
  return out;
}

// Full safety pipeline: neutralize phrasing, redact long digit runs, then
// assert no secret-like phrase remains. If something risky survives, we
// force human_review_required=true and rewrite the summary to a safe stub.
export function enforceSafety(text) {
  const cleaned = neutralize(sanitizeDigits(text ?? ''));
  const stillSensitive = containsSecret(cleaned);
  return { cleaned, safe: !stillSensitive };
}
