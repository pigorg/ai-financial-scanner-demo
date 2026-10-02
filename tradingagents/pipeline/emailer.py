"""SMTP email delivery for the pipeline's per-stage reports.

Degrades gracefully when SMTP_HOST is unset (prints the report instead of
sending) so the pipeline can still be run/tested without mail configured.
"""

from __future__ import annotations

import smtplib
from email.message import EmailMessage
from pathlib import Path

from tradingagents.pipeline import config


def send_report(subject: str, body: str, attachments: list[str] | None = None) -> None:
    if not config.SMTP_HOST:
        print(f"[emailer] SMTP_HOST not configured — printing report instead.\n\nSubject: {subject}\n\n{body}")
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = config.SMTP_FROM
    msg["To"] = config.REPORT_EMAIL_TO
    msg.set_content(body)

    for path in attachments or []:
        p = Path(path)
        if not p.exists():
            continue
        data = p.read_bytes()
        maintype, subtype = ("image", "png") if p.suffix.lower() == ".png" else ("application", "octet-stream")
        msg.add_attachment(data, maintype=maintype, subtype=subtype, filename=p.name)

    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=30) as smtp:
        if config.SMTP_USE_TLS:
            smtp.starttls()
        if config.SMTP_USER and config.SMTP_PASSWORD:
            smtp.login(config.SMTP_USER, config.SMTP_PASSWORD)
        smtp.send_message(msg)
