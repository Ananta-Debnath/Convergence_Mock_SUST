# Convergence_Mock_SUST

> CRM Ticket Sorter — a PERN-style service (Express API + Vite/React client) that classifies a single customer complaint into `case_type` / `severity` / `department` and produces a one-line agent summary. Rules-first, with an optional Gemini LLM fallback when confidence is low.

See the submission section below for the live URLs and team details. The full project layout, run instructions, and API contract are documented further down.

## Project layout

```
.
├── api/                  Express + TypeScript REST API
│   ├── src/
│   │   ├── index.ts          boot + listen
│   │   ├── app.ts            express middleware pipeline
│   │   ├── config.ts         zod-validated env
│   │   ├── routes/
│   │   │   ├── health.ts     GET  /health
│   │   │   └── sortTicket.ts POST /sort-ticket
│   │   └── lib/
│   │       ├── schemas.ts    request/response zod schemas
│   │       ├── keywords.ts   bilingual (en + bn) keyword tables
│   │       ├── classifier.ts scoring + confidence
│   │       ├── routing.ts    department + severity + human_review
│   │       ├── summarizer.ts templated summary + safety scrubber
│   │       └── llm.ts        Gemini fallback wrapper
│   ├── test/                 Vitest suites (public cases + safety)
│   ├── Dockerfile            Render image
│   └── package.json
├── client/               Vite + React + TypeScript demo UI
│   ├── src/
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── vite.config.ts        dev proxy → API
│   └── package.json
├── render.yaml           Render blueprint (API + static client)
├── package.json          npm workspaces root
├── tsconfig.base.json    shared TS compiler options
└── .env.example          copy to .env (gitignored) to run locally
```

## Quick start

```bash
# 1. install
npm install

# 2. (optional) enable LLM fallback
cp .env.example api/.env
# edit api/.env and set GEMINI_API_KEY=...

# 3. run API + client in parallel
npm run dev
# API  → http://localhost:3001
# UI   → http://localhost:5173
```

## API

### `GET /health`

```json
{ "status": "ok", "service": "crm-ticket-sorter", "uptime": 12.345 }
```

### `POST /sort-ticket`

Request:

```json
{
  "ticket_id": "T-001",
  "channel": "app",
  "locale": "en",
  "message": "I sent 5000 taka to a wrong number this morning, please help me get it back"
}
```

Response:

```json
{
  "ticket_id": "T-001",
  "case_type": "wrong_transfer",
  "severity": "high",
  "department": "dispute_resolution",
  "agent_summary": "Customer reports sending 5000 BDT to a wrong number and requests recovery.",
  "human_review_required": true,
  "confidence": 0.85
}
```

`human_review_required` is always `true` when `severity == "critical"` or `case_type == "phishing_or_social_engineering"`.

The `agent_summary` is **never** allowed to ask the customer for a PIN, OTP, password, or full card number — a post-processing safety scrubber enforces this and rewrites any such sentence.

## Tests

```bash
npm test
```

Covers the 5 public sample cases, 5 Bangla variants, the contested-refund + scam routing rule, the safety scrubber, body-validation `400`s, and an end-to-end POST round-trip.

## Submission

| Field | Value |
|---|---|
| Team name | _fill in_ |
| GitHub repository | https://github.com/Ananta-Debnath/Convergence_Mock_SUST |
| Live API base URL | _fill in (must be HTTPS, /health must respond)_ |
| Deployment platform | Render |
| LLM used | Optional — Gemini (`gemini-1.5-flash`) when `GEMINI_API_KEY` is set and rules confidence < 0.5; otherwise rules-only |
| Known issues / blockers | _optional_ |