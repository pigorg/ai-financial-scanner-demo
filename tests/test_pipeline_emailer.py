"""Tests for the pipeline's SMTP delivery / graceful no-SMTP fallback."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tradingagents.pipeline import config, emailer


@pytest.mark.unit
def test_send_report_prints_when_smtp_not_configured(capsys, monkeypatch):
    monkeypatch.setattr(config, "SMTP_HOST", None)
    emailer.send_report("Subject", "Body text")
    captured = capsys.readouterr()
    assert "Subject" in captured.out
    assert "Body text" in captured.out


@pytest.mark.unit
def test_send_report_sends_via_smtp_when_configured(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "SMTP_HOST", "smtp.example.invalid")
    monkeypatch.setattr(config, "SMTP_PORT", 587)
    monkeypatch.setattr(config, "SMTP_USER", "user@example.invalid")
    monkeypatch.setattr(config, "SMTP_PASSWORD", "secret")
    monkeypatch.setattr(config, "SMTP_FROM", "user@example.invalid")
    monkeypatch.setattr(config, "REPORT_EMAIL_TO", "informazioni@alessandrognola.com")
    monkeypatch.setattr(config, "SMTP_USE_TLS", True)

    png = tmp_path / "chart.png"
    png.write_bytes(b"\x89PNG\r\n")

    fake_smtp = MagicMock()
    fake_smtp.__enter__.return_value = fake_smtp
    with patch.object(emailer.smtplib, "SMTP", return_value=fake_smtp) as smtp_cls:
        emailer.send_report("Subject", "Body", attachments=[str(png)])

    smtp_cls.assert_called_once_with("smtp.example.invalid", 587, timeout=30)
    fake_smtp.starttls.assert_called_once()
    fake_smtp.login.assert_called_once_with("user@example.invalid", "secret")
    fake_smtp.send_message.assert_called_once()
    sent_msg = fake_smtp.send_message.call_args[0][0]
    assert sent_msg["To"] == "informazioni@alessandrognola.com"
    assert sent_msg.is_multipart()


@pytest.mark.unit
def test_send_report_skips_missing_attachment(monkeypatch):
    monkeypatch.setattr(config, "SMTP_HOST", "smtp.example.invalid")
    monkeypatch.setattr(config, "SMTP_USER", None)
    monkeypatch.setattr(config, "SMTP_PASSWORD", None)

    fake_smtp = MagicMock()
    fake_smtp.__enter__.return_value = fake_smtp
    with patch.object(emailer.smtplib, "SMTP", return_value=fake_smtp):
        emailer.send_report("Subject", "Body", attachments=["/no/such/file.png"])

    fake_smtp.login.assert_not_called()
    fake_smtp.send_message.assert_called_once()
