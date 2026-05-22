# Railway Deployment

This repo is configured for a single Railway web service that serves both the Flask API and the static FinTrack frontend.

## Project Setup

1. In Railway, click **Create a New Project**.
2. Choose **Deploy from GitHub repo**.
3. Pick `anasselmanaa/FinTrack`.
4. Add a **PostgreSQL** service in the same Railway project.
5. Open the Flask service variables and add the production variables below.

Railway will read `railway.json` and start the app with:

```bash
cd backend && gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --timeout 120
```

`--workers 1` is intentional because the app includes scheduled jobs. Running multiple workers can send duplicate scheduled emails.

## Required Variables

Set these first:

```bash
APP_ENV=production
FLASK_SECRET_KEY=<long-random-secret>
FRONTEND_ORIGINS=https://<your-railway-domain>
FRONTEND_APP_URL=https://<your-railway-domain>
FINTRACK_DEV_AUTO_LOGIN=false
FINTRACK_LOCAL_AUTO_LOGIN=false
FINTRACK_SHOW_DEMO_DATA=false
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_SAMESITE=Lax
```

For the database, connect the PostgreSQL service to the Flask service and use Railway's `DATABASE_URL` variable.

## Optional Production Variables

Add these when the related feature is ready:

```bash
ANTHROPIC_API_KEY=<your-anthropic-key>
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
RESEND_API_KEY=<your-resend-api-key>
EMAIL_FROM=FinTrack <hello@fintrack.app>
EMAIL_REPLY_TO=help@fintrack.app
SUPPORT_EMAIL=help@fintrack.app
BUGS_EMAIL=bugs@fintrack.app
IDEAS_EMAIL=ideas@fintrack.app
```

## Public URL

After the first successful deploy:

1. Open the Flask service.
2. Go to **Settings**.
3. Find **Networking**.
4. Click **Generate Domain**.
5. Copy the generated `https://...railway.app` URL.
6. Update `FRONTEND_ORIGINS` and `FRONTEND_APP_URL` to that URL.
7. Redeploy the service.

## Stripe Webhook

After the app has a public domain, create a Stripe webhook endpoint:

```text
https://<your-railway-domain>/api/billing/webhook
```

Subscribe to these events:

```text
checkout.session.completed
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

Paste Stripe's webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
