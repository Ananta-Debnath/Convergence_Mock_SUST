// Tiny pino logger factory. Imports are deferred so tests can stub env.
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'sust-crm-triage-api' },
  redact: {
    paths: ['req.headers.authorization', 'LLM_API_KEY'],
    censor: '[redacted]',
  },
});
