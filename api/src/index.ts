import { createApp } from "./app.js";
import { env } from "./config.js";

const app = createApp();
const port = env.PORT;

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] crm-ticket-sorter listening on :${port} (${env.NODE_ENV})`);
});

// Graceful shutdown — Render sends SIGTERM on deploys.
const shutdown = (signal: NodeJS.Signals) => {
  // eslint-disable-next-line no-console
  console.log(`[api] ${signal} received, closing...`);
  server.close((err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error("[api] close error", err);
      process.exit(1);
    }
    process.exit(0);
  });
  // Hard exit if close hangs
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);