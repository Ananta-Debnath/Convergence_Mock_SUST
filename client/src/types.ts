/**
 * Mirror of the API response shape. Kept in sync manually so the client
 * doesn't depend on the API workspace at build time. If the API schema
 * changes, update this file too.
 */
export type CaseType =
  | "wrong_transfer"
  | "payment_failed"
  | "refund_request"
  | "phishing_or_social_engineering"
  | "other";

export type Severity = "low" | "medium" | "high" | "critical";

export type Department =
  | "customer_support"
  | "dispute_resolution"
  | "payments_ops"
  | "fraud_risk";

export interface SortTicketRequest {
  ticket_id: string;
  channel?: "app" | "sms" | "call_center" | "merchant_portal";
  locale?: "bn" | "en" | "mixed";
  message: string;
}

export interface SortTicketResponse {
  ticket_id: string;
  case_type: CaseType;
  severity: Severity;
  department: Department;
  agent_summary: string;
  human_review_required: boolean;
  confidence: number;
}