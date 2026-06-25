/**
 * Optional Gemini LLM fallback.
 *
 * Rules:
 *   - Only runs when GEMINI_API_KEY is set in env.
 *   - Only invoked when the rules-based confidence is below `CONFIDENCE_FLOOR`.
 *   - Hard timeout via `LLM_TIMEOUT_MS`; on any error (parse, network, schema
 *     mismatch) we silently fall back to the rules-only result.
 *
 * Implementation note: we deliberately do not import the SDK at the top level
 * so the service still boots on hosts where the SDK isn't installed (the API
 * works rules-only without it). We import lazily inside the function.
 */
/// <reference types="node" />

import { env, hasLlmKey } from "../config.js";
import {
  CaseTypeSchema,
  DepartmentSchema,
  SeveritySchema,
} from "./schemas.js";
import type { CaseType, Department, Severity } from "./schemas.js";
import type { RoutedTicket } from "./routing.js";
import { safetyScrub } from "./summarizer.js";

export interface RefinedResult {
  case_type: CaseType;
  severity: Severity;
  department: Department;
  summary: string;
}

export interface MaybeRefineInput {
  message: string;
  locale: string | undefined;
  rules: RoutedTicket;
}

const SYSTEM_PROMPT = `You are a CRM ticket classifier for a digital finance company.
Classify the customer's message into exactly one case_type, severity, department and a one-sentence agent_summary.

Allowed case_type values:
- wrong_transfer
- payment_failed
- refund_request
- phishing_or_social_engineering
- other

Allowed severity values: low, medium, high, critical.
Allowed department values: customer_support, dispute_resolution, payments_ops, fraud_risk.

Rules:
1. NEVER ask the customer for an OTP, PIN, password, CVV or full card number in agent_summary.
2. Set severity=critical and department=fraud_risk for phishing_or_social_engineering.
3. Output ONLY a single JSON object with the four keys: case_type, severity, department, agent_summary.
4. No prose, no markdown, no code fences.`;

export async function maybeRefine(input: MaybeRefineInput): Promise<RefinedResult | null> {
  if (!hasLlmKey) return null;
  if (input.rules.confidence >= env.CONFIDENCE_FLOOR) return null;

  try {
    // Lazy import — keeps cold-start fast and avoids hard dep when no key.
    // @ts-ignore - lazy-loaded optional dependency; only used when GEMINI_API_KEY is set.
    const mod = (await import("@google/generative-ai")) as unknown as {
      GoogleGenerativeAI: new (key: string) => {
        getGenerativeModel: (cfg: { model: string; systemInstruction?: string }) => {
          generateContent: (req: string) => Promise<{ response: { text(): string } }>;
        };
      };
    };
    const client = new mod.GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = client.getGenerativeModel({
      model: env.GEMINI_MODEL,
      systemInstruction: SYSTEM_PROMPT,
    });

    const userPrompt = `locale=${input.locale ?? "unknown"}\nmessage=${input.message}\n\nReturn JSON only.`;
    const text = await withTimeout(model.generateContent(userPrompt), env.LLM_TIMEOUT_MS);
    const raw = text.response.text().trim();

    const parsed = safeParseJson(raw);
    if (!parsed) return null;

    const caseType = CaseTypeSchema.safeParse(parsed.case_type);
    const severity = SeveritySchema.safeParse(parsed.severity);
    const department = DepartmentSchema.safeParse(parsed.department);
    const summary = typeof parsed.agent_summary === "string" ? parsed.agent_summary.trim() : "";

    if (!caseType.success || !severity.success || !department.success || summary.length === 0) {
      return null;
    }

    return {
      case_type: caseType.data,
      severity: severity.data,
      department: department.data,
      summary: safetyScrub(summary),
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[llm] refine failed, falling back to rules:", (err as Error).message);
    return null;
  }
}

function safeParseJson(raw: string): Record<string, unknown> | null {
  // Strip code fences if the model wraps the JSON.
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const v = JSON.parse(cleaned);
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    // try to find a JSON object in the text
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const v = JSON.parse(cleaned.slice(start, end + 1));
        if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("llm_timeout")), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}