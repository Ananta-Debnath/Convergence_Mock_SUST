// Deterministic, layered rules classifier.
// All five public cases should map to a non-"other" case_type, and the
// severity / department / human_review_required flags must be sensible.

const LARGE_AMOUNT_BDT = 5000;

function compile(...patterns) {
  return new RegExp(patterns.map((p) => `(?:${p})`).join('|'), 'i');
}

const RE = {
  phishing: compile(
    String.raw`\bpin\b`,
    String.raw`\botp\b`,
    String.raw`\bone[-\s]?time\b`,
    String.raw`\bpassword\b`,
    String.raw`\bpasscode\b`,
    String.raw`\bcvv\b`,
    String.raw`\bcvc\b`,
    String.raw`\bsocial\s+engineering\b`,
    String.raw`verify\s+your\s+account`,
    String.raw`share\s+.*\bcode\b`,
    String.raw`send\s+(?:me\s+)?(?:the\s+)?(?:otp|pin|code)`,
    String.raw`is\s+that\s+(?:bkash|nagad|rocket)\b.*\?`,
  ),
  wrongTransfer: compile(
    String.raw`wrong\s+(?:number|account|recipient|person)`,
    String.raw`sent\s+.*\s+to\s+.*\s+(?:by\s+mistake|mistakenly|accidentally)`,
    String.raw`mistakenly\s+sent`,
    String.raw`wrongly\s+sent`,
    String.raw`sent\s+to\s+the\s+wrong`,
    String.raw`by\s+mistake`,
  ),
  paymentFailed: compile(
    String.raw`payment\s+(?:failed|declined|deducted|but)`,
    String.raw`balance\s+(?:deducted|was\s+deducted)`,
    String.raw`double\s+debited`,
    String.raw`transaction\s+failed`,
    String.raw`money\s+was\s+deducted`,
    String.raw`deducted\s+but\s+(?:i\s+)?(?:didn|haven|have\s+not)`,
    String.raw`amount\s+(?:was\s+)?deducted`,
  ),
  refund: compile(
    String.raw`\brefund\b`,
    String.raw`\bchargeback\b`,
    String.raw`return\s+my\s+money`,
    String.raw`reimburse`,
    String.raw`i\s+want\s+my\s+money\s+back`,
    String.raw`refund\s+my`,
    String.raw`money\s+back`,
  ),
  largeAmount: compile(
    String.raw`(?:\d{2,})`,
  ),
};

// Returns a number (in BDT-ish) extracted from the message, or null.
function extractAmount(message) {
  // Match things like "5000 taka", "taka 5000", "BDT 12,000", "5000tk".
  const m = message.match(/(?:taka|bdt|tk)\s*([0-9][0-9,]*)|([0-9][0-9,]*)\s*(?:taka|bdt|tk)/i);
  if (!m) return null;
  const raw = (m[1] || m[2] || '').replace(/,/g, '');
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function classify(message) {
  const text = (message ?? '').toString();
  const signals = {
    phishing: RE.phishing.test(text),
    wrongTransfer: RE.wrongTransfer.test(text),
    paymentFailed: RE.paymentFailed.test(text),
    refund: RE.refund.test(text),
    urgent: /\b(urgent|immediately|asap|right\s+now)\b/i.test(text),
    fraudClaim: /\b(unauthori[sz]ed|fraud|stolen|scam)\b/i.test(text),
    contest: /\b(contest|dispute|chargeback)\b/i.test(text),
  };

  // Highest priority: phishing / social engineering.
  if (signals.phishing) {
    return {
      case_type: 'phishing_or_social_engineering',
      severity: 'critical',
      department: 'fraud_risk',
      human_review_required: true,
      confidence: 0.95,
      signals,
    };
  }

  // Wrong transfer (sent to wrong account / number).
  if (signals.wrongTransfer) {
    const amount = extractAmount(text);
    const isLarge = amount !== null && amount >= LARGE_AMOUNT_BDT;
    const severeLanguage = /\b(all\s+my\s+savings|emergency|asap|immediately)\b/i.test(text);
    return {
      case_type: 'wrong_transfer',
      severity: isLarge || severeLanguage ? 'critical' : 'high',
      department: 'dispute_resolution',
      human_review_required: true,
      confidence: 0.9,
      signals,
    };
  }

  // Payment failed / deducted but not credited.
  if (signals.paymentFailed) {
    return {
      case_type: 'payment_failed',
      severity: 'high',
      department: 'payments_ops',
      human_review_required: false,
      confidence: 0.9,
      signals,
    };
  }

  // Refund / chargeback.
  if (signals.refund) {
    const urgent = signals.urgent || signals.fraudClaim;
    const isDispute = signals.contest || signals.fraudClaim;
    return {
      case_type: 'refund_request',
      severity: urgent ? 'high' : 'medium',
      department: isDispute ? 'dispute_resolution' : 'customer_support',
      human_review_required: signals.fraudClaim,
      confidence: 0.85,
      signals,
    };
  }

  // Default catch-all.
  return {
    case_type: 'other',
    severity: 'low',
    department: 'customer_support',
    human_review_required: false,
    confidence: 0.5,
    signals,
  };
}
