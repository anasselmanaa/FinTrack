import html
import os
from dataclasses import dataclass
from datetime import datetime

try:
    import resend
except ImportError:  # pragma: no cover - exercised when dependency is absent
    resend = None

SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "help@fintrack.app").strip()
BUGS_EMAIL = os.getenv("BUGS_EMAIL", "bugs@fintrack.app").strip()
IDEAS_EMAIL = os.getenv("IDEAS_EMAIL", "ideas@fintrack.app").strip()
TRANSACTIONAL_FROM_EMAIL = os.getenv("EMAIL_FROM", "FinTrack <hello@fintrack.app>").strip()


def _env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _frontend_url(path=""):
    base = os.getenv("FRONTEND_APP_URL") or os.getenv("FRONTEND_ORIGIN") or "http://127.0.0.1:5500"
    base = base.rstrip("/")
    if not path:
        return base
    return f"{base}/{path.lstrip('/')}"


def _app_url(query=""):
    base = os.getenv("FRONTEND_APP_URL") or os.getenv("FRONTEND_ORIGIN") or "http://127.0.0.1:5500"
    base = base.rstrip("/")
    local_frontend = "127.0.0.1" in base or "localhost" in base
    path = "frontend/index.html" if local_frontend else ""
    separator = "&" if "?" in path else "?"
    suffix = f"{separator}{query.lstrip('?')}" if query else ""
    return _frontend_url(f"{path}{suffix}" if path else suffix)


@dataclass(frozen=True)
class EmailResult:
    status: str
    provider: str = "resend"
    message_id: str | None = None
    error: str | None = None


class EmailNotConfigured(RuntimeError):
    pass


class EmailDeliveryError(RuntimeError):
    pass


class ResendEmailClient:
    def __init__(self):
        self.api_key = os.getenv("RESEND_API_KEY", "").strip()
        self.from_email = TRANSACTIONAL_FROM_EMAIL
        self.reply_to = os.getenv("EMAIL_REPLY_TO", SUPPORT_EMAIL).strip()
        self.enabled = _env_bool("EMAIL_ENABLED", bool(self.api_key))

    def configured(self):
        return bool(self.enabled and self.api_key and self.from_email and resend is not None)

    def send(self, *, to, subject, html_body, text_body=None, tags=None):
        if not self.enabled:
            return EmailResult(status="disabled")

        if resend is None:
            raise EmailNotConfigured("Install the resend package to send email")

        if not self.api_key:
            raise EmailNotConfigured("Set RESEND_API_KEY to send email")

        if not self.from_email:
            raise EmailNotConfigured("Set EMAIL_FROM to send email")

        resend.api_key = self.api_key
        params = {
            "from": self.from_email,
            "to": [to] if isinstance(to, str) else list(to),
            "subject": subject,
            "html": html_body,
        }

        if text_body:
            params["text"] = text_body
        if self.reply_to:
            params["reply_to"] = self.reply_to
        if tags:
            params["tags"] = tags

        try:
            response = resend.Emails.send(params)
        except Exception as exc:  # pragma: no cover - network/provider failure
            raise EmailDeliveryError(str(exc)) from exc

        message_id = None
        if isinstance(response, dict):
            message_id = response.get("id")
        else:
            message_id = getattr(response, "id", None)

        return EmailResult(status="sent", message_id=message_id)


email_client = ResendEmailClient()


def refresh_email_client():
    global email_client
    email_client = ResendEmailClient()
    return email_client


def _escape(value):
    return html.escape(str(value or ""), quote=True)


def _money(amount, currency="USD"):
    symbol = "$" if currency in {"USD", "CAD"} else f"{currency} "
    return f"{symbol}{amount}"


def _friendly_date(value):
    if isinstance(value, datetime):
        return value.strftime("%B %-d, %Y")
    return str(value)


def render_email(
    preheader,
    heading,
    body_html,
    cta_label=None,
    cta_url=None,
    secondary_cta_label=None,
    secondary_cta_url=None,
):
    cta_html = ""
    support_email = _escape(os.getenv("EMAIL_REPLY_TO", SUPPORT_EMAIL).strip())
    if cta_label and cta_url:
        primary_btn = f"""
          <a href="{_escape(cta_url)}"
             style="display:inline-block;background:#143d35;color:#ffffff;text-decoration:none;
                    font-weight:800;border-radius:8px;padding:14px 22px;margin:0 8px 8px 0;">
            {_escape(cta_label)}
          </a>
        """
        secondary_btn = ""
        if secondary_cta_label and secondary_cta_url:
            secondary_btn = f"""
              <a href="{_escape(secondary_cta_url)}"
                 style="display:inline-block;background:transparent;color:#143d35;text-decoration:none;
                        font-weight:700;border-radius:8px;padding:13px 20px;
                        border:1.5px solid #c5d8cd;margin:0 0 8px 0;">
                {_escape(secondary_cta_label)}
              </a>
            """
        cta_html = f"""
          <p style="margin:28px 0 10px;">
            {primary_btn}{secondary_btn}
          </p>
        """

    return f"""<!doctype html>
<html>
  <body style="margin:0;background:#f6f4ea;font-family:Inter,Arial,sans-serif;color:#143d35;">
    <div style="display:none;max-height:0;overflow:hidden;">{_escape(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f4ea;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                 style="max-width:560px;background:#ffffff;border:1px solid #d8e6dc;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:28px 30px 10px;">
                <div style="font-size:28px;font-weight:900;letter-spacing:-0.3px;">FinTrack<span style="color:#98bfa3;">.</span></div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 30px 30px;">
                <h1 style="font-size:30px;line-height:1.12;margin:0 0 16px;color:#143d35;">{_escape(heading)}</h1>
                <div style="font-size:16px;line-height:1.65;color:#2b5c51;">{body_html}</div>
                {cta_html}
                <p style="margin:28px 0 0;font-size:13px;line-height:1.5;color:#6d827b;">
                  Need help? Reply to this email or write to {support_email}.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def welcome_trial_email(user):
    name = _escape(user.get("first_name") or user.get("name") or "there")
    trial_ends = user.get("trial_ends_at")
    trial_line = ""
    if trial_ends:
        trial_line = f"<p>Your 14-day trial runs until <strong>{_escape(_friendly_date(trial_ends))}</strong>. No card is charged unless you choose a paid plan.</p>"

    html_body = f"""
      <p>Hi {name}, welcome to FinTrack.</p>
      <p>Your account is ready. Add a few real transactions, set one budget, then ask Money Coach something specific. That is where the app starts to feel useful.</p>
      {trial_line}
    """
    return {
        "subject": "Welcome to FinTrack",
        "html_body": render_email(
            "Your FinTrack trial is ready.",
            "Your trial is ready",
            html_body,
            "Open FinTrack",
            _app_url(),
        ),
        "text_body": "Welcome to FinTrack. Your trial is ready. Open FinTrack to add transactions, budgets, and goals.",
    }


def email_verification_email(user, verify_url):
    name = _escape(user.get("first_name") or user.get("name") or "there")
    html_body = f"""
      <p>Hi {name}, welcome to FinTrack.</p>
      <p>Please confirm this email address so we know your account belongs to you and important billing/security messages can reach you.</p>
      <p>This link expires soon and can only be used once.</p>
    """
    return {
        "subject": "Verify your FinTrack email",
        "html_body": render_email(
            "Verify your FinTrack email address.",
            "Verify your email",
            html_body,
            "Verify email",
            verify_url,
        ),
        "text_body": f"Verify your FinTrack email: {verify_url}",
    }


def trial_decision_email(user):
    """The single 'decide' email promised in trial.html — lands around day 12.
    Two clear paths, no panic, no countdown drip."""
    name = _escape(user.get("first_name") or user.get("name") or "there")
    trial_ends = user.get("trial_ends_at")
    end_date_display = _escape(_friendly_date(trial_ends)) if trial_ends else "in 48 hours"
    end_date_line = f"on <strong>{end_date_display}</strong>" if trial_ends else end_date_display

    currency = (user.get("preferred_currency") or "USD").upper()
    price = _money("6.99", "CAD") if currency == "CAD" else _money("4.99", "USD")
    price_label = f"{price}/month" + (" CAD" if currency == "CAD" else " USD")

    html_body = f"""
      <p>Hi {name},</p>
      <p>Quick note — your FinTrack trial ends {end_date_line}. This is the only reminder we'll send. No countdown drip, no panic mail tomorrow.</p>
      <p>Two paths from here:</p>
      <ul style="padding-left:20px;margin:14px 0;line-height:1.7;">
        <li><strong>Keep using FinTrack</strong> — add billing now and stay on at <strong>{_escape(price_label)}</strong>. Cancel any month, no clawback.</li>
        <li><strong>Walk away</strong> — close this email and do nothing. The trial ends quietly. <strong>No charge.</strong> Your data stays where it is (export any time).</li>
      </ul>
      <p>That's it. Pick whichever feels right.</p>
    """
    text_body = (
        f"Hi {name},\n\n"
        f"Your FinTrack trial ends {('on ' + _friendly_date(trial_ends)) if trial_ends else 'in 48 hours'}. "
        f"This is the only reminder we'll send.\n\n"
        f"Two paths:\n"
        f"  • Keep using FinTrack — add billing now ({price_label}). Cancel any month.\n"
        f"  • Walk away — do nothing. Trial ends quietly. No charge.\n\n"
        f"Add billing: {_app_url('open=billing')}\n"
        f"Cancel + export: {_app_url('open=settings')}\n"
    )
    return {
        "subject": "Your FinTrack trial ends soon — one email, two paths",
        "html_body": render_email(
            "Your FinTrack trial ends soon. Pick a path — we'll only mail you once.",
            "Two paths from here.",
            html_body,
            "Keep using FinTrack",
            _app_url("open=billing"),
            secondary_cta_label="Walk away (keep my data)",
            secondary_cta_url=_app_url("open=settings"),
        ),
        "text_body": text_body,
    }


def trial_ended_email(user):
    """Sent the day the trial expires (or the next time the cron runs after).
    Tone: friendly, no guilt, makes clear data is still there."""
    name = _escape(user.get("first_name") or user.get("name") or "there")
    currency = (user.get("preferred_currency") or "USD").upper()
    price = _money("6.99", "CAD") if currency == "CAD" else _money("4.99", "USD")
    price_label = f"{price}/month" + (" CAD" if currency == "CAD" else " USD")

    html_body = f"""
      <p>Hi {name},</p>
      <p>Your 14-day FinTrack trial just ended. <strong>You weren't charged.</strong></p>
      <p>Your account, transactions, budgets, and history are still there — your dashboard just dropped to read-only. You can:</p>
      <ul style="padding-left:20px;margin:14px 0;line-height:1.7;">
        <li><strong>Reactivate</strong> any time at {_escape(price_label)} — we'll restore full access immediately.</li>
        <li><strong>Export everything</strong> as CSV from Settings → Export.</li>
        <li><strong>Delete your account</strong> from Settings → Account, if you'd rather not have it sitting around.</li>
      </ul>
      <p>No follow-up drip. This is the last automated email you'll get unless you reactivate.</p>
    """
    text_body = (
        f"Hi {name},\n\n"
        f"Your FinTrack trial just ended. You weren't charged.\n\n"
        f"Your data is still there — your dashboard is read-only. You can:\n"
        f"  • Reactivate at {price_label}\n"
        f"  • Export everything as CSV from Settings → Export\n"
        f"  • Delete your account from Settings → Account\n\n"
        f"Reactivate: {_app_url('open=billing')}\n"
        f"This is the last automated email you'll get unless you reactivate.\n"
    )
    return {
        "subject": "Your FinTrack trial has ended — your data is safe",
        "html_body": render_email(
            "Your FinTrack trial just ended. You weren't charged. Your data is still there.",
            "Your trial has ended.",
            html_body,
            "Reactivate FinTrack",
            _app_url("open=billing"),
        ),
        "text_body": text_body,
    }


def payment_receipt_email(user, invoice):
    """Sent after every successful Stripe charge. Required by most tax
    authorities + acts as the customer's record of payment."""
    name = _escape(user.get("first_name") or user.get("name") or "there")

    # Amount + currency from Stripe (always in smallest currency unit, e.g. cents).
    amount_cents = invoice.get("amount_paid") or 0
    currency_code = (invoice.get("currency") or "usd").upper()
    amount = f"{(amount_cents / 100):.2f}"
    price = _money(amount, currency_code)

    invoice_number = _escape(invoice.get("number") or invoice.get("id") or "")
    period_end_ts = invoice.get("period_end")
    next_charge_date = _friendly_date(datetime.utcfromtimestamp(period_end_ts)) if period_end_ts else None
    period_start_ts = invoice.get("period_start")
    period_line = ""
    if period_start_ts and period_end_ts:
        period_line = (
            f"<p style=\"font-size:14px;color:#587971;margin:6px 0 0;\">"
            f"Covers <strong>{_escape(_friendly_date(datetime.utcfromtimestamp(period_start_ts)))} – "
            f"{_escape(_friendly_date(datetime.utcfromtimestamp(period_end_ts)))}</strong>.</p>"
        )

    # Stripe's hosted invoice page — gives the customer a real receipt URL.
    hosted_url = invoice.get("hosted_invoice_url") or _app_url("open=billing")
    pdf_url = invoice.get("invoice_pdf")
    pdf_line = (
        f"<p style=\"margin:6px 0 0;font-size:13px;\">"
        f"<a href=\"{_escape(pdf_url)}\" style=\"color:#143d35;\">Download PDF receipt</a></p>"
    ) if pdf_url else ""

    next_line = ""
    if next_charge_date:
        next_line = (
            f"<p style=\"margin:14px 0 0;font-size:14px;color:#587971;\">"
            f"Your next charge of <strong>{_escape(price)}</strong> is on "
            f"<strong>{_escape(next_charge_date)}</strong>. Manage or cancel any time in Settings → Billing.</p>"
        )

    html_body = f"""
      <p>Hi {name},</p>
      <p>Thanks — this email confirms your FinTrack Pro payment went through.</p>
      <table style="margin:18px 0;border-collapse:collapse;font-size:15px;">
        <tr><td style="padding:6px 16px 6px 0;color:#587971;">Amount</td><td style="padding:6px 0;color:#143d35;font-weight:700;">{_escape(price)}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#587971;">Plan</td><td style="padding:6px 0;color:#143d35;">FinTrack Pro (monthly)</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#587971;">Invoice #</td><td style="padding:6px 0;color:#143d35;font-family:monospace;">{invoice_number}</td></tr>
      </table>
      {period_line}
      {pdf_line}
      {next_line}
    """
    text_body = (
        f"Hi {name},\n\n"
        f"Thanks — your FinTrack Pro payment of {price} went through.\n\n"
        f"  Plan: FinTrack Pro (monthly)\n"
        f"  Invoice #: {invoice.get('number') or invoice.get('id') or ''}\n"
    )
    if period_start_ts and period_end_ts:
        text_body += (
            f"  Covers: {_friendly_date(datetime.utcfromtimestamp(period_start_ts))} – "
            f"{_friendly_date(datetime.utcfromtimestamp(period_end_ts))}\n"
        )
    if next_charge_date:
        text_body += f"\nYour next charge of {price} is on {next_charge_date}.\n"
    if pdf_url:
        text_body += f"\nPDF receipt: {pdf_url}\n"
    text_body += f"\nManage or cancel any time: {_app_url('open=billing')}\n"

    return {
        "subject": f"Receipt for your FinTrack Pro payment ({price})",
        "html_body": render_email(
            f"Receipt for your FinTrack Pro payment of {price}.",
            "Payment received",
            html_body,
            "View receipt online",
            hosted_url,
        ),
        "text_body": text_body,
    }


def payment_failed_email(user, invoice):
    """Sent when Stripe's recurring charge fails. Tells the user clearly what
    happened and what to do — friendly tone, no shame, single CTA."""
    name = _escape(user.get("first_name") or user.get("name") or "there")

    amount_cents = invoice.get("amount_due") or invoice.get("amount_paid") or 0
    currency_code = (invoice.get("currency") or "usd").upper()
    amount = f"{(amount_cents / 100):.2f}"
    price = _money(amount, currency_code)

    next_attempt_ts = invoice.get("next_payment_attempt")
    next_attempt_line = ""
    if next_attempt_ts:
        retry_date = _friendly_date(datetime.utcfromtimestamp(next_attempt_ts))
        next_attempt_line = (
            f"<p>We'll try the card again on <strong>{_escape(retry_date)}</strong>. "
            f"If you'd like to swap to a new card before then, update it in Settings → Billing.</p>"
        )
    else:
        next_attempt_line = (
            f"<p>We won't retry automatically. To keep your subscription active, "
            f"please update your payment method in Settings → Billing.</p>"
        )

    hosted_url = invoice.get("hosted_invoice_url") or _app_url("open=billing")

    html_body = f"""
      <p>Hi {name},</p>
      <p>We tried to charge your card for <strong>{_escape(price)}</strong> today and it didn't go through. <strong>This is usually not your fault</strong> — it's often an expired card, a temporary block, or insufficient funds.</p>
      {next_attempt_line}
      <p style="margin:18px 0 0;font-size:14px;color:#587971;">You'll keep full access until we either complete the charge or run out of retries. No data is lost.</p>
    """
    text_body = (
        f"Hi {name},\n\n"
        f"Your FinTrack Pro charge of {price} didn't go through today. Usually this is an expired card, "
        f"a temporary block, or insufficient funds — not your fault.\n\n"
    )
    if next_attempt_ts:
        text_body += f"We'll retry on {_friendly_date(datetime.utcfromtimestamp(next_attempt_ts))}.\n\n"
    text_body += (
        f"Update your card any time: {_app_url('open=billing')}\n"
        f"View the invoice: {hosted_url}\n"
    )

    return {
        "subject": f"Heads up — your FinTrack Pro charge of {price} didn't go through",
        "html_body": render_email(
            f"Your FinTrack Pro charge of {price} didn't go through.",
            "Quick payment issue",
            html_body,
            "Update payment method",
            _app_url("open=billing"),
            secondary_cta_label="View invoice",
            secondary_cta_url=hosted_url,
        ),
        "text_body": text_body,
    }


def subscription_active_email(user, currency="USD"):
    price = _money("6.99", "CAD") if currency == "CAD" else _money("4.99", "USD")
    html_body = f"""
      <p>Your FinTrack Pro subscription is active.</p>
      <p>Plan: <strong>{price}/month</strong>. Stripe handles your payment details; FinTrack never stores your card number.</p>
    """
    return {
        "subject": "FinTrack Pro is active",
        "html_body": render_email(
            "Your FinTrack Pro subscription is active.",
            "You are subscribed",
            html_body,
            "Open FinTrack",
            _app_url(),
        ),
        "text_body": f"Your FinTrack Pro subscription is active at {price}/month. Stripe handles payment details.",
    }


def subscription_canceled_email(user):
    html_body = """
      <p>Your FinTrack Pro subscription was cancelled.</p>
      <p>You keep access until the end of the billing period Stripe already processed. You can reactivate from Settings → Billing whenever you are ready.</p>
    """
    return {
        "subject": "Your FinTrack subscription was cancelled",
        "html_body": render_email(
            "Your FinTrack subscription was cancelled.",
            "Subscription cancelled",
            html_body,
            "Open billing settings",
            _app_url("open=billing"),
        ),
        "text_body": "Your FinTrack Pro subscription was cancelled. You can reactivate from Settings > Billing whenever you are ready.",
    }


def password_reset_email(user, reset_url):
    html_body = f"""
      <p>We received a request to reset your FinTrack password.</p>
      <p>Use the button below to choose a new password. This link expires soon and can only be used once.</p>
      <p>If you did not request this, you can ignore this email. Your password will stay the same.</p>
    """
    return {
        "subject": "Reset your FinTrack password",
        "html_body": render_email(
            "Reset your FinTrack password.",
            "Reset your password",
            html_body,
            "Reset password",
            reset_url,
        ),
        "text_body": f"Reset your FinTrack password: {reset_url}\n\nIf you did not request this, ignore this email.",
    }


def send_email(*, to, subject, html_body, text_body=None, tags=None):
    return email_client.send(
        to=to,
        subject=subject,
        html_body=html_body,
        text_body=text_body,
        tags=tags,
    )


def email_configured():
    return email_client.configured()
