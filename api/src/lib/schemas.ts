import { z } from "zod";

export const ChannelSchema = z.enum(["app", "sms", "call_center", "merchant_portal"]);
export const LocaleSchema = z.enum(["bn", "en", "mixed"]);

export const CaseTypeSchema = z.enum([
  "wrong_transfer",
  "payment_failed",
  "refund_request",
  "phishing_or_social_engineering",
  "other",
]);
export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const DepartmentSchema = z.enum([
  "customer_support",
  "dispute_resolution",
  "payments_ops",
  "fraud_risk",
]);

export type Channel = z.infer<typeof ChannelSchema>;
export type Locale = z.infer<typeof LocaleSchema>;
export type CaseType = z.infer<typeof CaseTypeSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type Department = z.infer<typeof DepartmentSchema>;

export const SortTicketRequestSchema = z.object({
  ticket_id: z.string().min(1).max(64),
  channel: ChannelSchema.optional(),
  locale: LocaleSchema.optional().default("en"),
  message: z.string().min(1).max(8000),
});

export type SortTicketRequest = z.infer<typeof SortTicketRequestSchema>;

export const SortTicketResponseSchema = z.object({
  ticket_id: z.string(),
  case_type: CaseTypeSchema,
  severity: SeveritySchema,
  department: DepartmentSchema,
  agent_summary: z.string().min(1).max(500),
  human_review_required: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export type SortTicketResponse = z.infer<typeof SortTicketResponseSchema>;
