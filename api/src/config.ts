import "dotenv/config";
import { z } from "zod";

/**
 * Centralised, zod-validated env loader. Importing this file is enough to
 * trigger dotenv loading and to crash early if anything required is missing.
 */
const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  CLIENT_ORIGIN: z.string().default("*"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-1.5-flash"),
  CONFIDENCE_FLOOR: z.coerce.number().min(0).max(1).default(0.5),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type AppEnv = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("[config] invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env: AppEnv = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const hasLlmKey = env.GEMINI_API_KEY.trim().length > 0;