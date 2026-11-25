# Development and deployment

Use Node.js 24 LTS. The app uses Angular 21 and PDF.js 6 with patched dependencies. Run `npm ci --legacy-peer-deps`, copy `.env.example` to `.env`, and set API/email credentials. Run `npm start` to launch Angular at `http://localhost:4200` and the API on port 3001. Use the Angular URL; Angular proxies `/api` and keeps authentication cookies on the same origin.

Generated Angular environment files contain public configuration only. Groq, YouTube, email, and database credentials stay on the server. Never put keys in frontend code or commit `.env` files.

Accounts use salted scrypt hashes and opaque HttpOnly session cookies. Without Redis, development stores accounts in ignored `.local/accounts.json`. This fallback is disabled in production. Do not share that file or use it for production storage.

## Validation

```sh
npm run test:server
npm test -- --watch=false --browsers=ChromeHeadless --progress=false
npm run build
npm audit
```

The browser suite requires Chrome. It covers OTP resend, session restoration, upload validation, bounded chunking, saved-data recovery, and real PowerPoint creation. Server tests cover hashing, session forgery/revocation, OTP single use, reset grants, delivery failures, rate limits, and request origins. Tests use temporary account storage and mocked email delivery.

## Vercel

The existing project is `ai-learning-hub`. Frontend output is `dist/ai-learning-hub/browser`; serverless endpoints are in `api/` and shared server code is in `server/`. Local development imports the same handlers.

Configure these server environment variables in production and preview:

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | AI requests |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Password reset email through Gmail SMTP |
| `GMAIL_FROM_NAME` | Optional email display name |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Durable Upstash Redis account/session storage |

Redis can alternatively use `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Disable eviction and automatic paid upgrades on the free plan. A missing database makes authentication fail closed with HTTP 503.

Run `vercel link --project ai-learning-hub`, then `vercel --prod`. Vercel runs `npm ci --legacy-peer-deps` and `npm run vercel-build`. A static-only deployment cannot provide authentication, AI, YouTube, or email.

`node --use-system-ca scripts/check-services.mjs .env.production.local` checks Redis and non-redacted API credentials without displaying secrets or sending email. Vercel replaces sensitive pulled values with `[SENSITIVE]`; verify those services through the deployed API.

## Transition and limitations

Old browser-only accounts cannot be securely imported because the server cannot establish ownership. Existing users register once after this update. Old browser credentials/session flags are removed. Saved mind maps, notes, and chat histories remain stored on that browser/device; they are not cloud-synchronized.

Study-note uploads support PDF, TXT, DOCX, and PPTX. Convert binary `.ppt` files to `.pptx` first. Scanned PDFs need text recognition before upload.

If API keys were previously embedded in a deployed frontend bundle, rotate them at the provider and update Vercel. New builds cannot revoke copies in older bundles. PDF/document dependencies still emit upstream CommonJS optimization warnings; the production build passes its size budgets.
