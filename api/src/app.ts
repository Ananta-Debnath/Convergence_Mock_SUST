import cors from "cors";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config.js";
import { healthRouter } from "./routes/health.js";
import { sortTicketRouter } from "./routes/sortTicket.js";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "64kb" }));

  // CORS — allow a configured origin list, or "*" for fully open.
  const allowAny = env.CLIENT_ORIGIN.trim() === "*";
  app.use(
    cors({
      origin: allowAny
        ? true
        : env.CLIENT_ORIGIN.split(",")
            .map((o) => o.trim())
            .filter(Boolean),
      methods: ["GET", "POST", "OPTIONS"],
    }),
  );

  if (!process.env.VITEST) {
    app.use(morgan(env.NODE_ENV === "production" ? "tiny" : "dev"));
  }

  app.use("/health", healthRouter);
  app.use("/sort-ticket", sortTicketRouter);

  // 404 for anything else
  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  // Centralised error handler — keep last
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // eslint-disable-next-line no-console
    console.error("[error]", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}