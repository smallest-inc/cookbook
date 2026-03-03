import dotenv from 'dotenv';
import path from 'path';

// Load .env from server dir (__dirname = server/src when running) or cwd
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config(); // fallback: cwd/.env when run from server/

// Set TZ early so slot creation (e.g. "11 AM") uses calendar timezone
if (process.env.CALENDAR_TIMEZONE) {
  process.env.TZ = process.env.CALENDAR_TIMEZONE;
}

import { createServer } from './app';
import env from './utils/env';

const app = createServer();

app.listen(env.PORT, () => {
  const smtpOk = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.EMAIL_FROM);
  console.log(`Server listening on port ${env.PORT}`);
  console.log(`SMTP configured: ${smtpOk ? 'yes' : 'no'} (emails ${smtpOk ? 'will' : 'will NOT'} be sent)`);
});
