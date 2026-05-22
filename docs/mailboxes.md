# FinTrack Production Mailboxes

FinTrack promises three public support addresses:

- `help@fintrack.app` for account, billing, and general support
- `bugs@fintrack.app` for defects and broken flows
- `ideas@fintrack.app` for product suggestions

## Provider Setup

Create these as real mailboxes or aliases with your domain email provider:

- `help@fintrack.app`
- `bugs@fintrack.app`
- `ideas@fintrack.app`

Recommended routing:

- Route `help@fintrack.app` to the primary support inbox.
- Route `bugs@fintrack.app` to the primary support inbox plus an issue-triage label/filter.
- Route `ideas@fintrack.app` to the primary support inbox plus a roadmap label/filter.

## DNS

Add the email provider's required DNS records for `fintrack.app`:

- `MX` records for receiving mail
- `SPF` TXT record for allowed senders
- `DKIM` records for signed outbound mail
- `DMARC` TXT record for delivery policy and reporting

Keep Resend verified for transactional sending from `hello@fintrack.app`.

## Backend Environment

Production should include:

```env
EMAIL_FROM=FinTrack <hello@fintrack.app>
EMAIL_REPLY_TO=help@fintrack.app
SUPPORT_EMAIL=help@fintrack.app
BUGS_EMAIL=bugs@fintrack.app
IDEAS_EMAIL=ideas@fintrack.app
```

## Verification

Before launch:

- Send a test email to each public address and confirm it arrives.
- Reply from `help@fintrack.app` and confirm the user receives it.
- Send a transactional email and confirm replies go to `help@fintrack.app`.
- Check `/api/support/mailboxes` returns the three production addresses.
