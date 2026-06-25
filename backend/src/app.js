// Express app wiring: /health, /, /sort-ticket, JSON body cap, 404, error handler.
import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { logger } from './lib/logger.js';
import { sortTicketRouter } from './routes/sortTicket.js';

const JSON_LIMIT = '16kb';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: JSON_LIMIT }));
  app.use(pinoHttp({ logger }));

  // Root + /health: both return a small liveness payload so plain
  // browser visits to http://host:3000/ don't 404.
  const health = (_req, res) => res.status(200).json({ status: 'ok' });
  app.get('/', health);
  app.get('/health', health);

  app.use(sortTicketRouter);

  // 404 fallback
  app.use((req, res) => {
    res.status(404).json({ error: 'not_found', path: req.path });
  });

  // Centralized JSON error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'invalid_json' });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'payload_too_large' });
    }
    req.log?.error({ err: err?.message }, 'unhandled_error');
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}
