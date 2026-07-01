from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from app.core.config import settings

conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=465,
    MAIL_SERVER="mail.spacemail.com",
    MAIL_STARTTLS=False,
    MAIL_SSL_TLS=True,
    USE_CREDENTIALS=True,
)

async def send_invite_email(email: str, token: str):
    link = f"{settings.FRONTEND_URL}/complete-registration?token={token}"
    message = MessageSchema(
        subject="You're invited to Tekton",
        recipients=[email],
        body=f"""
        <h3>Welcome to Tekton</h3>
        <p>You have been invited to join Tekton. Click the link below to complete your registration:</p>
        <a href="{link}">{link}</a>
        <p>This link expires in 48 hours.</p>
        """,
        subtype="html"
    )
    fm = FastMail(conf)
    await fm.send_message(message)
    
async def send_reset_email(email: str, token: str):
    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    message = MessageSchema(
        subject="Reset your Tekton password",
        recipients=[email],
        body=f"""
        <h3>Password Reset Request</h3>
        <p>Click the link below to reset your Tekton password:</p>
        <a href="{link}">{link}</a>
        <p>This link expires in 24 hours. If you did not request this, ignore this email.</p>
        """,
        subtype="html"
    )
    fm = FastMail(conf)
    await fm.send_message(message)