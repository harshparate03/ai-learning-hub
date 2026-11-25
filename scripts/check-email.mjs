import dotenv from 'dotenv';
import { verifyEmailTransport } from '../server/email.js';
dotenv.config({ path: process.argv[2] || '.env', quiet: true });
try {
  await verifyEmailTransport();
  console.log('Gmail SMTP authentication passed. No email was sent.');
} catch (error) {
  console.error('Gmail SMTP authentication failed:', error.message);
  process.exitCode = 1;
}
