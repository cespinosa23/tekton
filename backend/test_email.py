import smtplib
import ssl
import sys
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

smtp_server = "mail.spacemail.com"
sender = "itadmin@tekton.energy"
password = "T3kt0n@2026!"
receiver = "engrtek@mailinator.com"

# Usage: python test_email.py [465|587]  (default 465)
port = int(sys.argv[1]) if len(sys.argv) > 1 else 465

msg = MIMEMultipart()
msg['From'] = sender
msg['To'] = receiver
msg['Subject'] = f"Test Email - Tekton Ledger (port {port})"
msg.attach(MIMEText(f"Test from Tekton Ledger via port {port}.", 'plain'))

print(f"Connecting to {smtp_server}:{port}...")
context = ssl.create_default_context()
try:
    if port == 465:
        with smtplib.SMTP_SSL(smtp_server, port, context=context) as server:
            server.login(sender, password)
            server.sendmail(sender, receiver, msg.as_string())
    else:
        with smtplib.SMTP(smtp_server, port) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(sender, password)
            server.sendmail(sender, receiver, msg.as_string())
    print(f"✓ Email sent successfully via port {port}")
except Exception as e:
    print(f"✗ Failed on port {port}:", e)
