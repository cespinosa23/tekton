import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

smtp_server = "mail.spacemail.com"
port = 465
sender = "itadmin@tekton.energy"
password = "T3kt0n@2026!"
receiver = "engrtek@mailinator.com"

msg = MIMEMultipart()
msg['From'] = sender
msg['To'] = receiver
msg['Subject'] = "Test Email - Tekton Ledger"
msg.attach(MIMEText("""
Hi,

This is a test email from Tekton Ledger.

If you received this, the SpaceMail SMTP setup is working correctly.

— Tekton Ledger
""", 'plain'))

print(f"Connecting to {smtp_server}:{port}...")
context = ssl.create_default_context()
try:
    with smtplib.SMTP_SSL(smtp_server, port, context=context) as server:
        server.login(sender, password)
        server.sendmail(sender, receiver, msg.as_string())
        print("✓ Email sent successfully to", receiver)
except Exception as e:
    print("✗ Failed:", e)
