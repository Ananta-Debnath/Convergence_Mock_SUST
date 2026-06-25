/**
 * Pure, deterministic rules-based classifier.
 *
 *   classify(message, locale) -> {
 *     case_type,           // argmax across all groups
 *     confidence,          // 0..1, topScore / (topScore + runnerUp + 1)
 *     scores,              // per-case_type raw score
 *     matchedTerms,        // strings that contributed to the winning group
 *   }
 *
 * Bilingual handling:
 *   - When `locale === "en"` we still consider Bangla hits (BN customers often
 *     transliterate) but only count each keyword once across languages.
 *   - When `locale === "bn"` English hits still count.
 *   - When `locale === "mixed"` (or undefined) both languages are weighted
 *     equally.
 */

import { KEYWORDS, PATTERNS } from "./keywords.js";
import type { CaseType, Locale } from "./schemas.js";

export interface ClassificationResult {
  case_type: CaseType;
  confidence: number;
  scores: Record<CaseType, number>;
  matchedTerms: string[];
}

const CASE_TYPES = [
  "wrong_transfer",
  "payment_failed",
  "refund_request",
  "phishing_or_social_engineering",
  "other",
] as const satisfies readonly CaseType[];

function normalise(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns the matched keywords for a group against the normalised message. */
function findHits(messageLower: string, group: typeof KEYWORDS[CaseType], locale: Locale): string[] {
  const hits: string[] = [];

  // For BN messages, only count Bangla hits; for EN, English hits; for mixed,
  // count both. Keywords are already lower-case (English) or normalised
  // (Bangla).
  const lists: string[] = [];
  if (locale !== "en") lists.push(...group.bn);
  if (locale !== "bn") lists.push(...group.en);

  for (const kw of lists) {
    if (!kw) continue;
    const needle = kw.toLowerCase();
    if (messageLower.includes(needle)) {
      hits.push(kw);
    }
  }
  return hits;
}

function findPatternHits(messageRaw: string, groupKey: CaseType): string[] {
  const hits: string[] = [];
  const patterns: RegExp[] = PATTERNS[groupKey] ?? [];
  for (const re of patterns) {
    const m = messageRaw.match(re);
    if (m) hits.push(m[0]);
  }
  return hits;
}

export function classify(message: string, locale: Locale | undefined): ClassificationResult {
  const lower = normalise(message);

  // Score = (keyword hits * 1) + (pattern hits * 2) * group.weight
  const scores: Record<CaseType, number> = {
    wrong_transfer: 0,
    payment_failed: 0,
    refund_request: 0,
    phishing_or_social_engineering: 0,
    other: 0,
  };
  const matched: Record<CaseType, string[]> = {
    wrong_transfer: [],
    payment_failed: [],
    refund_request: [],
    phishing_or_social_engineering: [],
    other: [],
  };

  for (const ct of CASE_TYPES) {
    if (ct === "other") continue; // "other" is the fallback only
    const group = KEYWORDS[ct]!;
    const kwHits = findHits(lower, group, locale ?? "mixed");
    const patHits = findPatternHits(message, ct);

    scores[ct] = (kwHits.length + patHits.length * 2) * group.weight;
    matched[ct] = [...kwHits, ...patHits];
  }

  // Argmax with weight tie-break already encoded in scores.
  let top: CaseType = "other";
  let runner = 0;
  let topScore = 0;
  for (const ct of CASE_TYPES) {
    const s = scores[ct] ?? 0;
    if (s > topScore) {
      topScore = s;
      top = ct;
    }
  }
  // Compute runner-up for confidence.
  for (const ct of CASE_TYPES) {
    if (ct === top) continue;
    const s = scores[ct] ?? 0;
    if (s > runner) runner = s;
  }

  if (topScore === 0) {
    // No signal at all → "other" with low confidence.
    return {
      case_type: "other",
      confidence: 0.3,
      scores,
      matchedTerms: [],
    };
  }

  // Confidence in (0, 1] — top relative to top + runner-up + smoothing.
  const confidence = Math.min(1, topScore / (topScore + runner + 1));

  return {
    case_type: top,
    confidence,
    scores,
    matchedTerms: matched[top] ?? [],
  };
}