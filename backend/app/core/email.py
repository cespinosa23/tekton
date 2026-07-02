import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings


def _build_conf():
    return {
        "server": "mail.spacemail.com",
        "port": 465,
        "username": settings.MAIL_USERNAME,
        "password": settings.MAIL_PASSWORD,
        "sender": settings.MAIL_FROM,
    }


def _send(to: str, subject: str, html: str):
    c = _build_conf()
    msg = MIMEMultipart("alternative")
    msg["From"] = c["sender"]
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(html, "html"))

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL(c["server"], c["port"], context=context) as server:
        server.login(c["username"], c["password"])
        server.sendmail(c["sender"], to, msg.as_string())


def send_invite_email(email: str, token: str):
    link = f"{settings.FRONTEND_URL}/complete-registration?token={token}"
    _send(
        to=email,
        subject="You're invited to Tekton Ledger",
        html=f"""
        <h3>Welcome to Tekton Ledger</h3>
        <p>You have been invited to join Tekton Ledger.
        Click the link below to complete your registration:</p>
        <p><a href="{link}">{link}</a></p>
        <p>This link expires in 48 hours.</p>
        """,
    )


def send_reset_email(email: str, token: str):
    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    _send(
        to=email,
        subject="Reset your Tekton Ledger password",
        html=f"""
        <h3>Password Reset Request</h3>
        <p>Click the link below to reset your Tekton Ledger password:</p>
        <p><a href="{link}">{link}</a></p>
        <p>This link expires in 24 hours. If you did not request this, ignore this email.</p>
        """,
    )
