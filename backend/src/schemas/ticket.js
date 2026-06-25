// Zod schemas + enum constants for the API contract.
// Dependency-free so other modules (rules, llm, eval) can import the enums
// without pulling in Express.
import { z } from 'zod';

export const CASE_TYPES = [
  'phishing_or_social_engineering',
  'wrong_transfer',
  'payment_failed',
  'refund_request',
  'other',
];

export const SEVERITIES = ['low', 'medium', 'high', 'critical'];

export const DEPARTMENTS = [
  'fraud_risk',
  'dispute_resolution',
  'payments_ops',
  'customer_support',
];

export const TicketRequest = z
  .object({
    ticket_id: z.string().min(1, 'ticket_id is required'),
    channel: z.string().min(1).optional(),
    locale: z.string().min(1).optional(),
    message: z.string().min(1, 'message is required'),
  })
  .strict();

export const TicketResponse = z
  .object({
    ticket_id: z.string(),
    case_type: z.enum(CASE_TYPES),
    severity: z.enum(SEVERITIES),
    department: z.enum(DEPARTMENTS),
    agent_summary: z
      .string()
      .min(1)
      .max(500)
      .refine((s) => s.trim().length > 0, 'agent_summary cannot be blank'),
    human_review_required: z.boolean(),
    confidence: z.number().min(0).max(1),
  })
  .strict();
