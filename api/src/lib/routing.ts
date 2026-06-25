/**
 * Routing & severity rules. Combines the raw classification result with the
 * spec's department table (§4.2), severity bumps, and the
 * `human_review_required` flag.
 */

import { classify, type ClassificationResult } from "./classifier.js";
import { KEYWORDS, bumpSeverity, extractAmount } from "./keywords.js";
import type {
  CaseType,
  Department,
  Locale,
  Severity,
} from "./schemas.js";

export interface RoutedTicket {
  case_type: CaseType;
  severity: Severity;
  department: Department;
  confidence: number;
  human_review_required: boolean;
  /** Why we made the decision (useful for the LLM prompt and for logs). */
  reasoning: string[];
}

/** Per-spec department table (§4.2) with one explicit override for
 *  refund_requests that mention scam/contest. */
function pickDepartment(caseType: CaseType, messageRaw: string): Department {
  // Override: a refund_request that ALSO mentions scam/contest/dispute is a
  // contested refund and routes to dispute_resolution.
  if (caseType === "refund_request") {
    const m = messageRaw.toLowerCase();
    if (/\b(scam|scam(?:mer|med)?|fraud|contest|dispute|cheat(?:ed)?|duped|stolen)\b/.test(m)) {
      return "dispute_resolution";
    }
    // Default refund → customer_support, unless severity is bumped high →
    // dispute_resolution as well (handled by the caller).
    return "customer_support";
  }
  return KEYWORDS[caseType]!.default_department;
}

function pickSeverity(caseType: CaseType, messageRaw: string): Severity {
  const base = KEYWORDS[caseType]!.default_severity;

  // Phishing is always critical.
  if (caseType === "phishing_or_social_engineering") return "critical";

  // payment_failed that explicitly mentions a deducted balance → high (often
  // already high, but enforced).
  if (caseType === "payment_failed") {
    const lower = messageRaw.toLowerCase();
    if (/\b(balance|amount|money)\s+(was\s+)?deducted\b/.test(lower)) return "high";
  }

  // Large amount → bump severity by 1.
  const amount = extractAmount(messageRaw);
  if (amount !== null && amount >= 10_000) {
    return bumpSeverity(base, 1);
  }
  return base;
}

export function decideRouting(
  message: string,
  locale: Locale | undefined,
  rules: ClassificationResult,
): RoutedTicket {
  const case_type = rules.case_type;
  let severity = pickSeverity(case_type, message);
  let department = pickDepartment(case_type, message);

  const reasoning: string[] = [];

  // Severity escalation: contested refund (scam mentioned) → high → dispute.
  if (case_type === "refund_request" && department === "dispute_resolution") {
    if (severity === "low") severity = "high";
    reasoning.push("contested refund → escalated to high / dispute_resolution");
  }

  // Phishing / critical always → fraud_risk + human review.
  let human_review_required = severity === "critical" || case_type === "phishing_or_social_engineering";

  if (rules.confidence < 0.4) {
    human_review_required = true;
    reasoning.push(`low confidence (${rules.confidence.toFixed(2)}) → human review`);
  }

  return {
    case_type,
    severity,
    department,
    confidence: rules.confidence,
    human_review_required,
    reasoning,
  };
}

/** Convenience: classify + route in one call. */
export function classifyAndRoute(message: string, locale: Locale | undefined): RoutedTicket {
  const rules = classify(message, locale);
  return decideRouting(message, locale, rules);
}