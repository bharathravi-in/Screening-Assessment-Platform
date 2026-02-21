"""Email notification service using SMTP.

Sends transactional emails: candidate invitations, assessment
completion notifications, and admin alerts.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.system_settings import SystemSettings

logger = logging.getLogger(__name__)


async def _get_smtp_config(db: AsyncSession) -> dict[str, Any]:
    """Load SMTP configuration from system_settings singleton."""
    result = await db.execute(select(SystemSettings))
    settings = result.scalar_one_or_none()
    if not settings:
        return {}
    return {
        "host": settings.smtp_host or "",
        "port": settings.smtp_port or 587,
        "username": settings.smtp_username or "",
        "password": settings.smtp_password or "",
        "from_address": settings.smtp_from_address or "",
        "from_name": settings.smtp_from_name or "Assessment Platform",
        "use_tls": settings.smtp_use_tls if settings.smtp_use_tls is not None else True,
    }


def _send_email_sync(
    smtp_config: dict[str, Any],
    to_email: str,
    subject: str,
    html_body: str,
    text_body: str | None = None,
) -> bool:
    """Synchronously send an email via SMTP.

    Returns True on success, False on failure.
    """
    if not smtp_config.get("host"):
        logger.warning("SMTP not configured — skipping email to %s", to_email)
        return False

    msg = MIMEMultipart("alternative")
    from_name = smtp_config.get("from_name", "Assessment Platform")
    from_addr = smtp_config.get("from_address", "")
    msg["From"] = f"{from_name} <{from_addr}>"
    msg["To"] = to_email
    msg["Subject"] = subject

    if text_body:
        msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        if smtp_config.get("use_tls", True):
            server = smtplib.SMTP(smtp_config["host"], smtp_config["port"], timeout=15)
            server.starttls()
        else:
            server = smtplib.SMTP(smtp_config["host"], smtp_config["port"], timeout=15)

        if smtp_config.get("username"):
            server.login(smtp_config["username"], smtp_config["password"])

        server.sendmail(from_addr, [to_email], msg.as_string())
        server.quit()
        logger.info("Email sent to %s: %s", to_email, subject)
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_email, exc)
        return False


async def send_invitation_email(
    db: AsyncSession,
    candidate_email: str,
    candidate_name: str,
    assessment_title: str,
    invite_link: str,
    expires_at: str | None = None,
    organization_name: str = "",
) -> bool:
    """Send a candidate invitation email."""
    smtp_config = await _get_smtp_config(db)

    subject = f"You're Invited: {assessment_title}"
    if organization_name:
        subject = f"{organization_name} — {subject}"

    expiry_text = ""
    if expires_at:
        expiry_text = f"""
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:14px;">Expires</td>
          <td style="padding:8px 0;font-size:14px;font-weight:500;">{expires_at}</td>
        </tr>"""

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">Assessment Invitation</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 16px;font-size:16px;color:#1f2937;">
            Hi <strong>{candidate_name or "there"}</strong>,
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#4b5563;line-height:1.6;">
            You have been invited to take an assessment. Please find the details below and click the button to get started.
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:14px;">Assessment</td>
              <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1f2937;">{assessment_title}</td>
            </tr>{expiry_text}
          </table>
          <div style="text-align:center;margin:32px 0;">
            <a href="{invite_link}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
              Start Assessment
            </a>
          </div>
          <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;text-align:center;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="{invite_link}" style="color:#6366f1;word-break:break-all;">{invite_link}</a>
          </p>
        </div>
        <div style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            This is an automated message. Please do not reply.
          </p>
        </div>
      </div>
    </body>
    </html>
    """

    text_body = f"""
Hi {candidate_name or "there"},

You've been invited to take the assessment: {assessment_title}

Click this link to start: {invite_link}

{"This link expires on: " + expires_at if expires_at else ""}
    """.strip()

    return _send_email_sync(smtp_config, candidate_email, subject, html_body, text_body)


async def send_completion_notification(
    db: AsyncSession,
    notify_emails: list[str],
    candidate_name: str,
    candidate_email: str,
    assessment_title: str,
    score_pct: float | None = None,
    is_passed: bool | None = None,
) -> int:
    """Send notification to HR/admin when a candidate completes an assessment.

    Returns count of emails sent.
    """
    smtp_config = await _get_smtp_config(db)
    if not smtp_config.get("host"):
        return 0

    subject = f"Assessment Completed: {candidate_name} — {assessment_title}"

    score_html = ""
    if score_pct is not None:
        status_color = "#10b981" if is_passed else "#ef4444"
        status_text = "PASSED" if is_passed else "NOT PASSED"
        score_html = f"""
        <tr>
          <td style="padding:8px 0;color:#6b7280;font-size:14px;">Score</td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;">{score_pct:.1f}%
            <span style="color:{status_color};font-size:12px;margin-left:8px;padding:2px 8px;border-radius:4px;background:{status_color}15;">{status_text}</span>
          </td>
        </tr>"""

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#10b981,#059669);padding:24px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:20px;">Assessment Completed</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 20px;font-size:15px;color:#4b5563;">
            A candidate has completed an assessment:
          </p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:14px;">Candidate</td>
              <td style="padding:8px 0;font-size:14px;font-weight:600;color:#1f2937;">{candidate_name}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:14px;">Email</td>
              <td style="padding:8px 0;font-size:14px;">{candidate_email}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#6b7280;font-size:14px;">Assessment</td>
              <td style="padding:8px 0;font-size:14px;">{assessment_title}</td>
            </tr>{score_html}
          </table>
        </div>
      </div>
    </body>
    </html>
    """

    sent = 0
    for email in notify_emails:
        if _send_email_sync(smtp_config, email, subject, html_body):
            sent += 1
    return sent


async def send_violation_alert(
    db: AsyncSession,
    notify_emails: list[str],
    candidate_name: str,
    assessment_title: str,
    violation_type: str,
    violation_count: int,
    max_violations: int,
) -> int:
    """Send alert when a candidate has a proctoring violation."""
    smtp_config = await _get_smtp_config(db)
    if not smtp_config.get("host"):
        return 0

    is_terminated = violation_count >= max_violations
    subject = f"{'⚠️ Session Terminated' if is_terminated else '⚡ Proctoring Violation'}: {candidate_name} — {assessment_title}"

    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="background:{'#dc2626' if is_terminated else '#f59e0b'};padding:24px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:20px;">
            {'Session Terminated' if is_terminated else 'Proctoring Violation'}
          </h1>
        </div>
        <div style="padding:32px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Candidate</td><td style="padding:6px 0;font-size:14px;font-weight:600;">{candidate_name}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Assessment</td><td style="padding:6px 0;font-size:14px;">{assessment_title}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Violation</td><td style="padding:6px 0;font-size:14px;">{violation_type}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Count</td><td style="padding:6px 0;font-size:14px;font-weight:600;">{violation_count} / {max_violations}</td></tr>
          </table>
        </div>
      </div>
    </body>
    </html>
    """

    sent = 0
    for email in notify_emails:
        if _send_email_sync(smtp_config, email, subject, html_body):
            sent += 1
    return sent
