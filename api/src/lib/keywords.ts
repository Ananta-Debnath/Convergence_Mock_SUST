/**
 * Bilingual keyword tables (English + Bangla) plus a small amount of pattern
 * data shared with the classifier and the summariser.
 *
 * The lists are intentionally hand-curated and small — accuracy matters more
 * than recall. If a real deployment ships these to production they should be
 * reviewed with a domain expert.
 */

import type { CaseType, Department, Locale, Severity } from "./schemas.js";

export interface KeywordGroup {
  /** Canonical English label of the case_type this group scores for. */
  case_type: CaseType;
  /** English / Romanised keywords. */
  en: string[];
  /** Bangla (Banglish) keywords. */
  bn: string[];
  /** Default severity when this group wins. */
  default_severity: Severity;
  /** Default department when this group wins. */
  default_department: Department;
  /** Tie-break weight — higher wins when scores match. */
  weight: number;
}

/**
 * Regex patterns that signal this case_type regardless of language.
 * Built to be permissive (e.g. wrong number patterns cover both EN + BN digit
 * formats and the ৳ taka sign).
 */
export const PATTERNS: Record<CaseType, RegExp[]> = {
  wrong_transfer: [
    // "sent 5000 to wrong number", "5000 taka went to a wrong number"
    /\b(sent|transfer(?:red|ring)?|paid|sent\s+by\s+mistake)\b[^.\n]{0,40}\b(wrong|incorrect|by\s*mistake|mistakenly)\b/i,
    /(\d{2,7})\s*(taka|bdt|টাকা|৳)\b[^.\n]{0,40}\b(wrong|incorrect|mistake|ভুল)\b/i,
    /\b(wrong\s*(?:number|account|recipient|person))\b/i,
    /\bভুল(?:\s*নম্বর|\s*নাম্বার|\s*অ্যাকাউন্ট|\s*হিসাব)?\b/,
    /\bভুলে\s*(?:পাঠাইছি|পাঠিয়েছি|পাঠানো)\b/,
  ],
  payment_failed: [
    /\b(payment|transaction|transfer)\s*(failed|failure|unsuccessful|declined|cancelled|canceled|timed?\s*out)\b/i,
    /\b(failed|couldn'?t\s+(?:complete|send|process|pay))\b[^.\n]{0,30}\b(payment|transaction|transfer)\b/i,
    /\b(balance\s+(?:was\s+)?deducted|amount\s+(?:was\s+)?deducted|money\s+(?:was\s+)?deducted)\b/i,
    /\bপেমেন্ট\s*(?:ব্যর্থ|ফেইল|হয়নি)\b/,
    /\bটাকা\s*(?:কেটে\s*গেছে|কাটা\s*হয়েছে|কেটে\s*নিয়েছে)\b/,
    /\bলেনদেন\s*(?:ব্যর্থ|সম্পন্ন\s*হয়নি)\b/,
  ],
  refund_request: [
    /\b(refund|return\s*(?:my|the)\s*money|chargeback|reverse\s*(?:the)?\s*(?:payment|transaction|transfer))\b/i,
    /\b(i\s*(?:want|need|would\s+like)\s+(?:a\s+)?refund|please\s+refund|kindly\s+refund)\b/i,
    /\b(i\s+changed\s+my\s+mind|don'?t\s+want\s+(?:it|this)\s+anymore)\b/i,
    /\b(টাকা\s*ফেরত|ফেরত\s*দিন|ফেরত\s*চাই|রিফান্ড)\b/,
  ],
  phishing_or_social_engineering: [
    /\b(otp|one[- ]time\s*password|pin|password|cvv|passcode)\b/i,
    /\b(verify|confirm|update|reactivate|unlock|secure)\b[^.\n]{0,40}\b(account|card|wallet)\b/i,
    /\b(click\s+(?:the\s+)?link|tap\s+(?:the\s+)?link|open\s+(?:the\s+)?link)\b/i,
    /\b(scammer|fraud(ster)?|phish(ing)?|social\s*engineer)\b/i,
    /\bকেউ\s*(?:ফোনে|মেসেজে)\s*(?:ওটিপি|পিন|পাসওয়ার্ড)\s*(?:চাইছে|চেয়েছে|জিজ্ঞেস)\b/,
    /\b(লিংকে\s*ক্লিক|লিংকে\s*ট্যাপ)\b/,
  ],
  other: [
    // Catch-all: matches very short / generic complaints. Real matching is
    // done by absence of any other group's signals, so this list stays empty
    // in practice.
  ],
};

/** Bilingual keyword tables per case_type. */
export const KEYWORDS: Record<CaseType, KeywordGroup> = {
  wrong_transfer: {
    case_type: "wrong_transfer",
    en: [
      "wrong number", "wrong account", "wrong person", "wrong recipient",
      "sent to wrong", "sent by mistake", "sent mistakenly", "transferred to wrong",
      "paid wrong person", "paid the wrong", "mistakenly sent", "mistakenly transferred",
      "incorrect number", "incorrect account",
    ],
    bn: [
      "ভুল নম্বরে", "ভুল নাম্বারে", "ভুল অ্যাকাউন্টে", "ভুল হিসাবে",
      "ভুলে পাঠাইছি", "ভুলে পাঠিয়েছি", "ভুলে টাকা পাঠাইছি", "ভুলে টাকা পাঠিয়েছি",
      "ভুল মানুষকে", "ভুল জনকে", "ভুল ব্যক্তিকে",
    ],
    default_severity: "high",
    default_department: "dispute_resolution",
    weight: 1.1,
  },
  payment_failed: {
    case_type: "payment_failed",
    en: [
      "payment failed", "transaction failed", "transfer failed", "payment unsuccessful",
      "transaction unsuccessful", "payment declined", "transaction declined",
      "payment cancelled", "transaction cancelled", "transaction canceled",
      "payment timed out", "transaction timed out", "could not complete payment",
      "couldn't complete payment", "balance deducted", "amount deducted", "money deducted",
    ],
    bn: [
      "পেমেন্ট ব্যর্থ", "পেমেন্ট ফেইল", "লেনদেন ব্যর্থ", "লেনদেন হয়নি",
      "টাকা কেটে গেছে", "টাকা কাটা হয়েছে", "টাকা কেটে নিয়েছে",
      "পেমেন্ট হয়নি", "ট্রানজেকশন ব্যর্থ",
    ],
    default_severity: "high",
    default_department: "payments_ops",
    weight: 1.0,
  },
  refund_request: {
    case_type: "refund_request",
    en: [
      "refund", "refund please", "please refund", "kindly refund", "want a refund",
      "need a refund", "want my money back", "money back", "return my money",
      "reverse the payment", "reverse the transaction", "reverse the transfer",
      "chargeback", "i changed my mind", "don't want it anymore",
    ],
    bn: [
      "টাকা ফেরত", "ফেরত দিন", "ফেরত চাই", "রিফান্ড", "রিফান্ড করুন",
      "টাকা ফেরত চাই", "ফেরত দিতে হবে",
    ],
    default_severity: "low",
    default_department: "customer_support",
    weight: 0.9,
  },
  phishing_or_social_engineering: {
    case_type: "phishing_or_social_engineering",
    en: [
      "otp", "one time password", "one-time password", "pin", "password",
      "cvv", "passcode", "share otp", "share pin", "send otp", "send pin",
      "give otp", "give pin", "tell me your otp", "tell me your pin",
      "verify your account", "verify your card", "update kyc",
      "click the link", "click this link", "tap the link",
      "scammer", "fraudster", "phishing", "social engineer",
    ],
    bn: [
      "ওটিপি", "পিন", "পাসওয়ার্ড", "পাসওয়ার্ড দিন", "ওটিপি দিন", "পিন দিন",
      "ওটিপি পাঠাও", "ওটিপি বলো", "পিন বলো",
      "অ্যাকাউন্ট ভেরিফাই", "কার্ড ভেরিফাই",
      "লিংকে ক্লিক", "লিংকে ট্যাপ",
      "প্রতারণা", "স্ক্যামার", "ফ্রড", "পরিচয় চুরি",
    ],
    default_severity: "critical",
    default_department: "fraud_risk",
    weight: 1.4,
  },
  other: {
    case_type: "other",
    en: [],
    bn: [],
    default_severity: "low",
    default_department: "customer_support",
    weight: 0.1,
  },
};

/** Severity ordering used for bumps. */
export const SEVERITY_ORDER: Severity[] = ["low", "medium", "high", "critical"];

export function bumpSeverity(s: Severity, by = 1): Severity {
  const idx = SEVERITY_ORDER.indexOf(s);
  const next = Math.min(SEVERITY_ORDER.length - 1, Math.max(0, idx + by));
  return SEVERITY_ORDER[next] ?? s;
}

/**
 * Extract the first monetary amount from the message, if any. Matches both
 * "5000 taka", "5000 BDT", "৳5000", and Bangla "৫০০০ টাকা".
 */
export function extractAmount(message: string): number | null {
  // Bangla digits → ASCII digits, then look for N followed by a currency hint.
  const bnMap: Record<string, string> = {
    "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
    "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
  };
  const normalised = message.replace(/[০-৯]/g, (d) => bnMap[d] ?? d);

  const patterns = [
    /\b(\d{2,7})\s*(taka|bdt|টাকা)\b/i,
    /৳\s*(\d{2,7})\b/,
    /\b(\d{2,7})\s*৳/,
    /\b(\d{2,7})\b(?=[^.\n]{0,8}\b(taka|bdt|টাকা)\b)/i,
  ];

  for (const p of patterns) {
    const m = normalised.match(p);
    if (m && m[1]) {
      const n = Number(m[1]);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

export type LocaleHint = Locale | undefined;
