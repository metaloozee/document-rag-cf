import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
  client: {
    //
  },
  experimental__runtimeEnv: process.env,
  server: {
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.preprocess(
      (str) => process.env.VERCEL_URL ?? str,
      process.env.VERCEL_URL ? z.string().min(1) : z.string().url()
    ),
    BLOB_READ_WRITE_TOKEN: z.string().min(1),
    DATABASE_URL: z.string().url(),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    GROQ_API_KEY: z.string().min(1),
    MISTRAL_API_KEY: z.string().min(1),
    NODE_ENV: z
      .enum(["development", "production", "preview"])
      .default("development"),
  },
});
