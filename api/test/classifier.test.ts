import { describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../src/app.js";
import { classify } from "../src/lib/classifier.js";
import { classifyAndRoute } from "../src/lib/routing.js";

// 5 PUBLIC SAMPLE CASES (spec §8) -----------------------------------------

describe("public sample cases (spec §8)", () => {
  it.each([
    {
      name: "wrong_transfer / high",
      message: "I sent 3000 to wrong number",
      expected_case_type: "wrong_transfer",
      expected_severity: "high",
    },
    {
      name: "payment_failed / high",
      message: "Payment failed but balance deducted",
      expected_case_type: "payment_failed",
      expected_severity: "high",
    },
    {
      name: "phishing_or_social_engineering / critical",
      message: "Someone called asking my OTP, is that bKash?",
      expected_case_type: "phishing_or_social_engineering",
      expected_severity: "critical",
    },
    {
      name: "refund_request / low",
      message: "Please refund my last transaction, I changed my mind",
      expected_case_type: "refund_request",
      expected_severity: "low",
    },
    {
      name: "other / low",
      message: "App crashed when I opened it",
      expected_case_type: "other",
      expected_severity: "low",
    },
  ])("$name", ({ message, expected_case_type, expected_severity }) => {
    const routed = classifyAndRoute(message, "en");
    expect(routed.case_type).toBe(expected_case_type);
    expect(routed.severity).toBe(expected_severity);
  });
});

// BILINGUAL COVERAGE -----------------------------------------------------

describe("Bangla keyword coverage", () => {
  it.each([
    {
      name: "BN wrong_transfer",
      message: "আমি ভুলে ৩০০০ টাকা ভুল নম্বরে পাঠিয়ে দিয়েছি",
      expected: "wrong_transfer",
    },
    {
      name: "BN payment_failed (balance deducted)",
      message: "পেমেন্ট ব্যর্থ হয়েছে, কিন্তু টাকা কেটে গেছে",
      expected: "payment_failed",
    },
    {
      name: "BN refund_request",
      message: "আমার শেষ লেনদেনের টাকা ফেরত দিন",
      expected: "refund_request",
    },
    {
      name: "BN phishing (OTP ask)",
      message: "কেউ ফোনে আমার ওটিপি চাইছে, এটা কি bKash?",
      expected: "phishing_or_social_engineering",
    },
    {
      name: "BN other (no signal)",
      message: "অ্যাপটি খুলতে সমস্যা হচ্ছে",
      expected: "other",
    },
  ])("$name", ({ message, expected }) => {
    const r = classify(message, "bn");
    expect(r.case_type).toBe(expected);
  });
});

// DEPARTMENT + HUMAN REVIEW RULES ----------------------------------------

describe("routing & severity rules", () => {
  it("phishing → fraud_risk + human review", () => {
    const r = classifyAndRoute("Someone is asking for my OTP", "en");
    expect(r.case_type).toBe("phishing_or_social_engineering");
    expect(r.department).toBe("fraud_risk");
    expect(r.severity).toBe("critical");
    expect(r.human_review_required).toBe(true);
  });

  it("contested refund (scam mention) → dispute_resolution + high", () => {
    const r = classifyAndRoute(
      "Please refund my last transaction, I think I was scammed",
      "en",
    );
    expect(r.case_type).toBe("refund_request");
    expect(r.department).toBe("dispute_resolution");
    expect(r.severity).toBe("high");
    expect(r.human_review_required).toBe(true);
  });

  it("plain refund → customer_support / low", () => {
    const r = classifyAndRoute("Please refund my order, I changed my mind", "en");
    expect(r.case_type).toBe("refund_request");
    expect(r.department).toBe("customer_support");
    expect(r.severity).toBe("low");
  });

  it("wrong_transfer with amount ≥ 10000 bumps severity", () => {
    const r = classifyAndRoute(
      "I sent 15000 taka to the wrong number this morning",
      "en",
    );
    expect(r.case_type).toBe("wrong_transfer");
    // wrong_transfer default is high, bump → critical
    expect(r.severity).toBe("critical");
    expect(r.human_review_required).toBe(true);
  });

  it("payment_failed with balance deducted → payments_ops / high", () => {
    const r = classifyAndRoute("Payment failed but my balance was deducted", "en");
    expect(r.case_type).toBe("payment_failed");
    expect(r.department).toBe("payments_ops");
    expect(r.severity).toBe("high");
  });

  it("low confidence triggers human_review_required", () => {
    // Force an ambiguous message that scores low; rules should set review.
    const r = classifyAndRoute("hmm", "en");
    expect(r.human_review_required).toBe(true);
  });
});

// ROUND-TRIP END-TO-END (through express) -------------------------------

describe("POST /sort-ticket round-trip", () => {
  const app = createApp();

  it("returns 200 + correct shape for a sample ticket", async () => {
    const res = await request(app)
      .post("/sort-ticket")
      .send({
        ticket_id: "T-001",
        channel: "app",
        locale: "en",
        message: "I sent 5000 taka to a wrong number this morning, please help me get it back",
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ticket_id: "T-001",
      case_type: "wrong_transfer",
      severity: expect.stringMatching(/^(medium|high|critical)$/),
      department: "dispute_resolution",
      human_review_required: expect.any(Boolean),
      confidence: expect.any(Number),
    });
    expect(typeof res.body.agent_summary).toBe("string");
    expect(res.body.agent_summary.length).toBeGreaterThan(0);
    // Safety: never ask for credentials.
    expect(res.body.agent_summary.toLowerCase()).not.toMatch(/\b(please\s+)?(share|send|give|tell)\b[^.\n]{0,30}\b(otp|pin|password|cvv)\b/);
  });

  it("returns 400 when message is missing", async () => {
    const res = await request(app)
      .post("/sort-ticket")
      .send({ ticket_id: "T-bad" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_request");
  });

  it("returns 400 when channel is invalid", async () => {
    const res = await request(app)
      .post("/sort-ticket")
      .send({ ticket_id: "T-bad", channel: "telegram", message: "hi" });
    expect(res.status).toBe(400);
  });

  it("returns 200 on the critical phishing sample", async () => {
    const res = await request(app)
      .post("/sort-ticket")
      .send({
        ticket_id: "T-phish",
        channel: "call_center",
        locale: "en",
        message: "Someone called asking my OTP, is that bKash?",
      });
    expect(res.status).toBe(200);
    expect(res.body.case_type).toBe("phishing_or_social_engineering");
    expect(res.body.severity).toBe("critical");
    expect(res.body.human_review_required).toBe(true);
  });

  it("returns 200 on the Bangla wrong_transfer sample", async () => {
    const res = await request(app)
      .post("/sort-ticket")
      .send({
        ticket_id: "T-bn",
        channel: "app",
        locale: "bn",
        message: "আমি ভুলে ৩০০০ টাকা ভুল নম্বরে পাঠিয়ে দিয়েছি",
      });
    expect(res.status).toBe(200);
    expect(res.body.case_type).toBe("wrong_transfer");
  });
});

describe("GET /health", () => {
  const app = createApp();

  it("returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("crm-ticket-sorter");
  });
});