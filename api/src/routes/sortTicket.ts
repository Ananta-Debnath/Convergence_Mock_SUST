import { Router, type Request, type Response, type NextFunction } from "express";

import { env } from "../config.js";
import { classify } from "../lib/classifier.js";
import { maybeRefine } from "../lib/llm.js";
import { decideRouting } from "../lib/routing.js";
import { buildSummary, safetyScrub } from "../lib/summarizer.js";
import { SortTicketRequestSchema, type SortTicketResponse } from "../lib/schemas.js";

export const sortTicketRouter: Router = Router();

/**
 * POST /sort-ticket
 * Body: SortTicketRequest (zod-validated)
 * Returns: SortTicketResponse (case_type, severity, department, summary, flags, confidence)
 *
 * Pipeline:
 *   1. Validate body                → 400 on failure
 *   2. Run rules classifier          → {case_type, severity, department, confidence, signals}
 *   3. Maybe refine via Gemini       → only when confidence < floor AND GEMINI_API_KEY set
 *   4. Build templated summary
 *   5. Safety-scrub the summary      → never ask for OTP/PIN/CVV/password
 *   6. Decide human_review_required
 *   7. Apply a 30 s overall timeout
 */
sortTicketRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = SortTicketRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "invalid_request",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    const body = parsed.data;

    const work = (async (): Promise<SortTicketResponse> => {
      const rules = classify(body.message, body.locale);
      const routed = decideRouting(body.message, body.locale, rules);

      let summary = buildSummary(body.message, body.locale, routed);

      // Optional LLM refinement. Silent fallback to rules on any error.
      const refined = await maybeRefine({
        message: body.message,
        locale: body.locale,
        rules: routed,
      });
      if (refined) {
        // Always run the safety scrubber — never trust LLM output blindly.
        summary = safetyScrub(refined.summary);
      } else {
        summary = safetyScrub(summary);
      }

      return {
        ticket_id: body.ticket_id,
        case_type: routed.case_type,
        severity: routed.severity,
        department: routed.department,
        agent_summary: summary,
        human_review_required: routed.human_review_required,
        confidence: Number(routed.confidence.toFixed(2)),
      };
    })();

    // 30 s ceiling — spec requirement.
    const result = await Promise.race([
      work,
      new Promise<SortTicketResponse>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 30_000),
      ),
    ]);

    res.status(200).json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "timeout") {
      // Spec requires < 30 s; respond with 504 instead of letting the platform
      // close the connection.
      if (!res.headersSent) res.status(504).json({ error: "timeout" });
      return;
    }
    // If the body was already partially streamed we can't recover; bail out
    // via the central error handler otherwise.
    if (!res.headersSent) next(err);
  }
});