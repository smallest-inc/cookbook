import nodemailer from 'nodemailer';
import env from '../utils/env';
import { logger } from '../middleware/logger';
import { generateIcs } from '../utils/icsGenerator';

type BookingConfirmationInput = {
  to: string | string[];
  attendeeName?: string;
  summary: string;
  startIso: string;
  endIso: string;
  eventLink?: string;
  meetLink?: string;
  organizerEmail: string;
  organizerName?: string;
};

class EmailService {
  private isConfigured() {
    return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.EMAIL_FROM);
  }

  async sendBookingConfirmation(input: BookingConfirmationInput) {
    if (!this.isConfigured()) {
      logger.warn('email_not_configured_skip_send', { to: input.to });
      return { sent: false, reason: 'smtp_not_configured' as const };
    }

    const recipients = Array.isArray(input.to) ? input.to : [input.to];
    const toStr = recipients.join(', ');

    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
      }
    });

    logger.info('email_sending', { to: toStr, from: env.SMTP_USER });

    const attendee = input.attendeeName || 'there';
    const subject = `Meeting confirmed: ${input.summary}`;
    const textLines = [
      `Hi ${attendee},`,
      '',
      'Your meeting has been confirmed. Please add the attached calendar invite to your calendar.',
      `Topic: ${input.summary}`,
      `Start: ${new Date(input.startIso).toString()}`,
      `End: ${new Date(input.endIso).toString()}`,
      input.meetLink ? `Google Meet: ${input.meetLink}` : undefined,
      input.eventLink ? `Calendar link: ${input.eventLink}` : undefined,
      '',
      'Thanks,',
      'Calendar Receptionist'
    ].filter(Boolean);

    const icsContent = generateIcs({
      summary: input.summary,
      startIso: input.startIso,
      endIso: input.endIso,
      meetLink: input.meetLink,
      organizerEmail: input.organizerEmail,
      organizerName: input.organizerName,
      attendeeEmail: Array.isArray(input.to) ? input.to[0] : input.to,
      attendeeName: input.attendeeName
    });

    try {
      await transporter.sendMail({
        from: env.EMAIL_FROM,
        to: toStr,
        subject,
        text: textLines.join('\n'),
        attachments: [
          {
            filename: 'invite.ics',
            content: icsContent,
            contentType: 'text/calendar; method=REQUEST'
          }
        ]
      });
      logger.info('email_sent', { to: toStr });
      return { sent: true as const };
    } catch (err: any) {
      logger.error('email_send_failed', {
        to: toStr,
        message: err?.message,
        code: err?.code,
        response: err?.response
      });
      throw err;
    }
  }
}

export default new EmailService();
