// POST /sort-ticket — request validation, classification, summary,
// safety recheck, and Zod-validated response.

import { Router } from 'express';
import { TicketRequest, TicketResponse } from '../schemas/ticket.js';
import { classify } from '../classify/rules.js';
import { buildSummary } from '../classify/summary.js';
import {
  isLlmEnabled,
  classifyWithLlm,
  generateSummary,
} from '../classify/llm.js';
import { enforceSafety } from '../lib/safety.js';
import { logger } from '../lib/logger.js';

const LOW_CONFIDENCE_THRESHOLD = 0.6;
const HANDLER_BUDGET_MS = 25_000;

export const sortTicketRouter = Router();

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('handler-timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

sortTicketRouter.post('/sort-ticket', async (req, res) => {
  const parse = TicketRequest.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      error: 'invalid_request',
      details: parse.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  const { ticket_id, message } = parse.data;

  try {
    const work = (async () => {
      const rulesResult = classify(message);
      let chosen = rulesResult;

      if (
        rulesResult.confidence < LOW_CONFIDENCE_THRESHOLD &&
        isLlmEnabled()
      ) {
        try {
          const llm = await classifyWithLlm(message);
          // Trust the LLM classification if it parses + passes safety.
          chosen = {
            case_type: llm.case_type,
            severity: llm.severity,
            department: llm.department,
            human_review_required: llm.human_review_required,
            confidence: llm.confidence,
            signals: rulesResult.signals,
          };
        } catch (err) {
          logger.warn({ err: err.message }, 'llm_fallback_failed');
        }
      }

      const { summary: templateSummary } = buildSummary(chosen);
      let summary = templateSummary;
      let summaryFromLlm = false;
      if (isLlmEnabled()) {
        try {
          summary = await generateSummary({
            message,
            case_type: chosen.case_type,
            severity: chosen.severity,
            department: chosen.department,
          });
          summaryFromLlm = true;
        } catch (err) {
          logger.warn({ err: err.message }, 'llm_summary_failed');
        }
      }
      const safety = enforceSafety(summary);

      const response = {
        ticket_id,
        case_type: chosen.case_type,
        severity: chosen.severity,
        department: chosen.department,
        agent_summary: safety.cleaned,
        human_review_required: chosen.human_review_required || !safety.safe,
        confidence: safety.safe ? chosen.confidence : Math.min(chosen.confidence, 0.4),
      };
      logger.info(
        { ticket_id, summary_source: summaryFromLlm ? 'llm' : 'template' },
        'sort_ticket_completed',
      );

      const finalParse = TicketResponse.safeParse(response);
      if (!finalParse.success) {
        throw new Error(`response schema mismatch: ${finalParse.error.message}`);
      }
      return finalParse.data;
    })();

    const result = await withTimeout(work, HANDLER_BUDGET_MS);
    return res.status(200).json(result);
  } catch (err) {
    if (err.message === 'handler-timeout') {
      return res.status(504).json({ error: 'timeout' });
    }
    logger.error({ err: err.message }, 'sort_ticket_failed');
    return res.status(500).json({ error: 'internal_error' });
  }
});
