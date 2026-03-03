import { z } from 'zod';

function normalizeEnvString(value: string) {
  // Handle accidental whitespace and quoted values in .env entries.
  const trimmed = value.trim();
  const unquoted = trimmed.replace(/^"(.*)"$/s, '$1');
  return unquoted;
}

const envSchema = z.object({
  PORT: z.string().default('4000').transform((s) => parseInt(s, 10)),
  SMALLEST_API_KEY: z.string(),
  SMALLEST_API_BASE_URL: z.string().url(),
  SMALLEST_RECEPTIONIST_AGENT_ID: z.string(),
  SMALLEST_DEFAULT_PHONE_NUMBER: z.string().optional(),
  GCP_CLIENT_EMAIL: z.string(),
  GCP_PRIVATE_KEY: z.string(),
  GCP_PROJECT_ID: z.string(),
  GCP_SUBJECT_EMAIL: z.string().email().optional(),
  GCP_IMPERSONATE: z.string().optional(),
  PUBLIC_WEBHOOK_BASE_URL: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_SECURE: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CALENDAR_TIMEZONE: z.string().default('America/Los_Angeles')
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables', parsed.error.format());
  throw new Error('Invalid environment variables');
}

const env = {
  PORT: parsed.data.PORT,
  SMALLEST_API_KEY: parsed.data.SMALLEST_API_KEY,
  SMALLEST_API_BASE_URL: parsed.data.SMALLEST_API_BASE_URL,
  SMALLEST_RECEPTIONIST_AGENT_ID: parsed.data.SMALLEST_RECEPTIONIST_AGENT_ID,
  SMALLEST_DEFAULT_PHONE_NUMBER: parsed.data.SMALLEST_DEFAULT_PHONE_NUMBER,
  GCP_CLIENT_EMAIL: parsed.data.GCP_CLIENT_EMAIL,
  GCP_PRIVATE_KEY: normalizeEnvString(parsed.data.GCP_PRIVATE_KEY).replace(/\\n/g, '\n'),
  GCP_PROJECT_ID: parsed.data.GCP_PROJECT_ID,
  GCP_SUBJECT_EMAIL: parsed.data.GCP_SUBJECT_EMAIL,
  GCP_IMPERSONATE: parsed.data.GCP_IMPERSONATE === 'true',
  PUBLIC_WEBHOOK_BASE_URL: parsed.data.PUBLIC_WEBHOOK_BASE_URL,
  SMTP_HOST: parsed.data.SMTP_HOST,
  SMTP_PORT: parsed.data.SMTP_PORT ? parseInt(parsed.data.SMTP_PORT, 10) : 587,
  SMTP_SECURE: parsed.data.SMTP_SECURE === 'true',
  SMTP_USER: parsed.data.SMTP_USER,
  SMTP_PASS: parsed.data.SMTP_PASS,
  EMAIL_FROM: parsed.data.EMAIL_FROM,
  CALENDAR_TIMEZONE: parsed.data.CALENDAR_TIMEZONE
};

export default env;
