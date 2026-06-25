import { describe, expect, it } from "vitest";

import { assertSafe, safetyScrub } from "../src/lib/summarizer.js";

/**
 * Safety rule (spec §5): the agent_summary field must never ask the
 * customer to share PIN, OTP, password, or full card number. Any response
 * that does will fail that test case automatically.
 */

const SENSITIVE_NOUN = /(otp|one[- ]time\s*password|pin(?:\s*number)?|password|passcode|cvv|cvc|card\s*number|full\s*card)/i;
const ASK_VERB = /\b(please\s+)?(share|send|give|tell|provide|forward|reveal|enter|type|submit)\b[^.\n]{0,30}\b(otp|pin|password|cvv|card\s*number|full\s*card)\b/i;

describe("safetyScrub()", () => {
  it("rewrites a sentence that asks the customer to share their OTP", () => {
    const out = safetyScrub(
      "Customer asks about a refund. Please share your OTP with the agent to verify.",
    );
    expect(ASK_VERB.test(out)).toBe(false);
    expect(out.toLowerCase()).toContain("never ask");
  });

  it("rewrites a sentence that asks for PIN", () => {
    const out = safetyScrub("Please send us your PIN so we can verify.");
    expect(ASK_VERB.test(out)).toBe(false);
  });

  it("rewrites a sentence that asks for password", () => {
    const out = safetyScrub("Kindly provide your password for verification.");
    expect(ASK_VERB.test(out)).toBe(false);
  });

  it("rewrites a sentence that asks for card number / CVV", () => {
    const out = safetyScrub("Please share your card number and CVV.");
    expect(ASK_VERB.test(out)).toBe(false);
    expect(SENSITIVE_NOUN.test(out)).toBe(false);
  });

  it("does NOT touch safe sentences", () => {
    const safe = "Customer reports a wrong transfer of 5000 BDT and asks the bank to help recover the funds.";
    expect(safetyScrub(safe)).toBe(safe);
  });

  it("always makes text safe via assertSafe()", () => {
    const evil = "Please share your OTP.";
    const safe = assertSafe(evil);
    expect(ASK_VERB.test(safe)).toBe(false);
    expect(SENSITIVE_NOUN.test(safe)).toBe(false);
  });

  it("handles Bangla ask patterns", () => {
    const out = safetyScrub("দয়া করে আপনার ওটিপি দিন।");
    expect(out.toLowerCase()).toContain("never ask");
  });
});
