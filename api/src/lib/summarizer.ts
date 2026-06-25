/**
 * Templated summary builder + safety scrubber.
 *
 * Safety rule (spec §5): the agent_summary must never ask the customer to
 * share a PIN, OTP, password, or full card number. The safety scrubber is the
 * last step in the pipeline so this holds even if the LLM misbehaves.
 */

import { extractAmount } from "./keywords.js";
import type { Locale } from "./schemas.js";
import type { RoutedTicket } from "./routing.js";

const SAFE_REWRITE =
  "An agent will never ask for a customer's OTP, PIN, password, or card number; please do not share them.";

/**
 * Phrases that look like the summary is asking the customer to share a
 * sensitive credential. We match broadly (verb + sensitive noun) so we catch
 * both English and Bangla sentences, then rewrite the offending sentence.
 */
const SENSITIVE_NOUN = String.raw`(?:otp|one[- ]time\s*password|pin(?:\s*number)?|password|passcode|cvv|cvc|card\s*number|full\s*card)`;
const ASK_VERB = String.raw`(?:share|send|give|tell|provide|forward|reveal|enter|type|submit|dikhao|পাঠাও|দাও|বলো|দিন)`;
const ASK_PATTERN = new RegExp(
  // eslint-disable-next-line no-useless-escape
  `\\b(?:please\\s+)?(?:don't|do\\s+not|never)?\\s*${ASK_VERB}\\b[^.\\n]{0,40}\\b${SENSITIVE_NOUN}\\b`,
  "i",
);

const SENSITIVE_KEYWORD = new RegExp(`\\b${SENSITIVE_NOUN}\\b`, "i");

/** Returns the summary with any "ask for credential" sentence replaced. */
export function safetyScrub(input: string): string {
  if (typeof input !== "string" || input.length === 0) return input;

  // 1. Sentence-level rewrite for "ask for credential" patterns.
  const sentences = input.split(/(?<=[.!?])\s+/);
  const scrubbed: string[] = [];
  for (const s of sentences) {
    if (ASK_PATTERN.test(s) || (SENSITIVE_KEYWORD.test(s) && /(ask|share|send|give|tell|need|require)/i.test(s))) {
      scrubbed.push(SAFE_REWRITE);
    } else {
      scrubbed.push(s);
    }
  }
  return scrubbed.join(" ").trim();
}

/** Final defensive sweep — returns safe text or `null` if unsafe. */
export function assertSafe(text: string): string {
  const scrubbed = safetyScrub(text);
  // After scrubbing, no sentence may still contain the ask-pattern.
  if (ASK_PATTERN.test(scrubbed)) {
    return SAFE_REWRITE;
  }
  return scrubbed;
}

/** Build a one-or-two sentence summary from the routing decision. */
export function buildSummary(message: string, locale: Locale | undefined, routed: RoutedTicket): string {
  const amount = extractAmount(message);
  const amountPhrase = amount !== null ? `${amount.toLocaleString("en-US")} BDT` : null;
  const ct = routed.case_type;

  switch (ct) {
    case "wrong_transfer": {
      const head = amountPhrase
        ? `Customer reports sending ${amountPhrase} to the wrong recipient`
        : "Customer reports sending money to the wrong recipient";
      return `${head} and asks the bank to help recover the funds.`;
    }
    case "payment_failed": {
      const head = amountPhrase
        ? `Customer reports a failed payment of ${amountPhrase}`
        : "Customer reports a failed payment";
      return /deducted/i.test(message)
        ? `${head} and states that the balance was deducted.`
        : `${head}.`;
    }
    case "refund_request": {
      return routed.department === "dispute_resolution"
        ? `Customer is requesting a refund for a transaction they believe was unauthorised and may need dispute handling.`
        : `Customer is requesting a refund for a recent transaction.`;
    }
    case "phishing_or_social_engineering": {
      return `Customer reports being contacted by someone asking for sensitive credentials; treat as suspected social-engineering and route to fraud risk immediately. ${SAFE_REWRITE}`;
    }
    case "other":
    default: {
      return `Customer has raised a query that does not match a standard case type and should be triaged by an agent.`;
    }
  }
}