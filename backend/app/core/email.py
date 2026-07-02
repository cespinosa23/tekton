import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from app.core.config import settings

_SMTP_SERVER = "mail.spacemail.com"
_SMTP_PORT = 465
_DISPLAY_NAME = "Tekton Ledger"


def _send(to: str, subject: str, html: str, plain: str):
    msg = MIMEMultipart("alternative")
    msg["From"] = formataddr((_DISPLAY_NAME, settings.MAIL_FROM))
    msg["To"] = to
    msg["Subject"] = subject
    msg["X-Mailer"] = "Tekton Ledger Mailer"
    # Plain text first — mail clients prefer the last matching part,
    # but including plain text is essential for spam score.
    msg.attach(MIMEText(plain, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(_SMTP_SERVER, _SMTP_PORT, context=context) as server:
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.sendmail(settings.MAIL_FROM, to, msg.as_string())


def send_invite_email(email: str, token: str):
    link = f"{settings.FRONTEND_URL}/complete-registration?token={token}"

    plain = (
        f"You have been invited to Tekton Ledger.\n\n"
        f"Complete your registration here:\n{link}\n\n"
        f"This link expires in 48 hours.\n\n"
        f"If you did not expect this invitation, please ignore this email.\n\n"
        f"— Tekton Ledger"
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
        <!-- Header -->
        <tr>
          <td style="background:#111827;padding:28px 40px;">
            <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">Tekton Ledger</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 16px;font-size:22px;color:#111827;">You've been invited</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              You have been invited to join <strong>Tekton Ledger</strong>.
              Click the button below to set up your account.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#111827;border-radius:6px;">
                  <a href="{link}"
                     style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">
                    Complete Registration
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
              Or copy this link into your browser:<br>
              <span style="color:#374151;word-break:break-all;">{link}</span>
            </p>
            <hr style="border:none;border-top:1px solid #e4e4e7;margin:32px 0;">
            <p style="margin:0;font-size:13px;color:#9ca3af;">
              This link expires in <strong>48 hours</strong>.
              If you did not expect this invitation, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              This message was sent by Tekton Ledger &mdash; itadmin@tekton.energy
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    _send(to=email, subject="You're invited to Tekton Ledger", html=html, plain=plain)


def send_reset_email(email: str, token: str):
    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    plain = (
        f"You requested a password reset for your Tekton Ledger account.\n\n"
        f"Reset your password here:\n{link}\n\n"
        f"This link expires in 24 hours.\n\n"
        f"If you did not request a password reset, please ignore this email. "
        f"Your password will not be changed.\n\n"
        f"— Tekton Ledger"
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e4e4e7;">
        <!-- Header -->
        <tr>
          <td style="background:#111827;padding:28px 40px;">
            <span style="color:#ffffff;font-size:20px;font-weight:bold;letter-spacing:0.5px;">Tekton Ledger</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 16px;font-size:22px;color:#111827;">Password Reset Request</h2>
            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
              We received a request to reset the password for your <strong>Tekton Ledger</strong> account.
              Click the button below to choose a new password.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#111827;border-radius:6px;">
                  <a href="{link}"
                     style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">
                    Reset Password
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">
              Or copy this link into your browser:<br>
              <span style="color:#374151;word-break:break-all;">{link}</span>
            </p>
            <hr style="border:none;border-top:1px solid #e4e4e7;margin:32px 0;">
            <p style="margin:0;font-size:13px;color:#9ca3af;">
              This link expires in <strong>24 hours</strong>.
              If you did not request a password reset, you can safely ignore this email —
              your password will not be changed.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e4e4e7;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              This message was sent by Tekton Ledger &mdash; itadmin@tekton.energy
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    _send(to=email, subject="Reset your Tekton Ledger password", html=html, plain=plain)
