// Process entrypoint. Reads PORT from env (default 3000).
import 'dotenv/config';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';

const app = createApp();
const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, () => {
  logger.info({ port }, 'server_listening');
});

function shutdown(signal) {
  logger.info({ signal }, 'shutting_down');
  server.close(() => process.exit(0));
  // hard stop after 5s
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
