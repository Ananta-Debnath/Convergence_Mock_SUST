// Build a 1-2 sentence neutral agent_summary from the classification result.
// The summary must NEVER echo or ask for PIN/OTP/PAN/CVV/passwords.

import { enforceSafety } from '../lib/safety.js';

const CASE_PHRASES = {
  phishing_or_social_engineering:
    'The message appears to describe a social-engineering or phishing attempt asking for sensitive credentials.',
  wrong_transfer:
    'The customer reports sending money to the wrong account or recipient and is requesting help recovering the funds.',
  payment_failed:
    'The customer reports a payment that failed or an amount that was deducted without a successful transaction.',
  refund_request:
    'The customer is requesting a refund or money back for a transaction.',
  other: 'The customer message does not match a known case type and needs general triage.',
};

const SEVERITY_PHRASES = {
  low: 'Severity is low.',
  medium: 'Severity is medium.',
  high: 'Severity is high and the case should be prioritized.',
  critical: 'Severity is critical; this case should be handled with the highest urgency.',
};

const DEPARTMENT_PHRASES = {
  fraud_risk: 'Route to the fraud and risk team for immediate review.',
  dispute_resolution: 'Route to the dispute resolution team to investigate the transaction.',
  payments_ops: 'Route to the payments operations team to reconcile the transaction.',
  customer_support: 'Route to the customer support team for general assistance.',
};

export function buildSummary(classification) {
  const phrase =
    CASE_PHRASES[classification.case_type] ?? CASE_PHRASES.other;
  const sev = SEVERITY_PHRASES[classification.severity] ?? SEVERITY_PHRASES.low;
  const dept = DEPARTMENT_PHRASES[classification.department] ?? DEPARTMENT_PHRASES.customer_support;

  const draft = `${phrase} ${sev} ${dept}`;
  const { cleaned, safe } = enforceSafety(draft);
  // ensureSafety always returns a string for `cleaned` because draft is a string.
  return { summary: cleaned, safe };
}
