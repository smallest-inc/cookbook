import { google } from 'googleapis';
import env from '../utils/env';

type Slot = { start: string; end: string };

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

class GoogleCalendarService {
  jwtClient: any;
  calendar: any;

  constructor() {
    const jwtOptions: any = {
      email: env.GCP_CLIENT_EMAIL,
      key: env.GCP_PRIVATE_KEY,
      scopes: SCOPES
    };
    // only set subject when explicit impersonation is enabled
    if (env.GCP_IMPERSONATE && env.GCP_SUBJECT_EMAIL) jwtOptions.subject = env.GCP_SUBJECT_EMAIL;
    this.jwtClient = new google.auth.JWT(jwtOptions);
    this.calendar = google.calendar({ version: 'v3', auth: this.jwtClient });
  }

  async findAvailableSlots(proposedSlots: Slot[] = []) {
    const now = Date.now();
    let timeMax = now + 1000 * 60 * 60 * 24 * 30; // default 30 days
    for (const s of proposedSlots) {
      const end = new Date(s.end).getTime();
      timeMax = Math.max(timeMax, end);
    }
    // Cap at 2 years ahead
    const twoYears = 1000 * 60 * 60 * 24 * 365 * 2;
    timeMax = Math.min(timeMax, now + twoYears);

    const targetCalendar = env.GCP_SUBJECT_EMAIL || env.GCP_CLIENT_EMAIL;
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const MAX_RANGE_DAYS = 50; // Google freebusy limits range to ~2 months; use 50 days to be safe

    // Split into chunks - Google freebusy rejects ranges > ~2 months
    const busy: Array<{ start: string; end: string }> = [];
    let chunkStart = now;
    while (chunkStart < timeMax) {
      const chunkEnd = Math.min(chunkStart + MAX_RANGE_DAYS * MS_PER_DAY, timeMax);
      const resource = {
        timeMin: new Date(chunkStart).toISOString(),
        timeMax: new Date(chunkEnd).toISOString(),
        items: [{ id: targetCalendar }]
      } as any;

      let fb;
      try {
        fb = await this.calendar.freebusy.query({ requestBody: resource });
      } catch (error: any) {
        const message = error?.message || 'Google Calendar freebusy query failed';
        if (typeof message === 'string' && message.includes('DECODER routines::unsupported')) {
          const err = new Error('Invalid GCP_PRIVATE_KEY format. Ensure it is copied from service-account JSON and uses \\n for newlines.');
          (err as any).status = 500;
          throw err;
        }
        const err = new Error(message);
        (err as any).status = error?.code || error?.response?.status || 502;
        throw err;
      }
      const chunkBusy = fb.data.calendars?.[targetCalendar]?.busy || [];
      busy.push(...chunkBusy);
      chunkStart = chunkEnd;
    }

    const available: Slot[] = [];
    // For each proposed slot, ensure it doesn't overlap busy ranges
    for (const slot of proposedSlots) {
      const sStart = new Date(slot.start).getTime();
      const sEnd = new Date(slot.end).getTime();
      const overlaps = busy.some((b: any) => {
        const bStart = new Date(b.start).getTime();
        const bEnd = new Date(b.end).getTime();
        return !(sEnd <= bStart || sStart >= bEnd);
      });
      if (!overlaps) available.push(slot);
    }

    return available;
  }

  async createEvent({
    start,
    end,
    summary,
    attendees = [],
    description
  }: {
    start: Date;
    end: Date;
    summary: string;
    attendees: any[];
    description?: string;
  }) {
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      const err = new Error('Invalid event start/end datetime');
      (err as any).status = 400;
      throw err;
    }
    if (end.getTime() <= start.getTime()) {
      const err = new Error('Event end must be after start');
      (err as any).status = 400;
      throw err;
    }

    const baseEvent = {
      summary,
      description: description || undefined,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees: attendees.map((a) => ({ email: a.email, displayName: a.displayName })),
      reminders: { useDefault: true }
    } as any;

    const eventWithMeet = {
      ...baseEvent,
      conferenceData: {
        createRequest: {
          conferenceSolutionKey: { type: 'hangoutsMeet' },
          requestId: `meet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        }
      }
    };

    const calendarId = env.GCP_SUBJECT_EMAIL || env.GCP_CLIENT_EMAIL;
    let created;
    try {
      created = await this.calendar.events.insert({
        calendarId,
        requestBody: eventWithMeet,
        sendUpdates: 'all',
        conferenceDataVersion: 1
      });
    } catch (error: any) {
      const gStatus = error?.code || error?.response?.status;
      const message = error?.message || 'Google Calendar event insert failed';

      // If domain-wide delegation is not configured, Google rejects attendee invites.
      if (typeof message === 'string' && message.includes('Domain-Wide Delegation')) {
        const fallbackEvent = { ...baseEvent, attendees: [] };
        created = await this.calendar.events.insert({
          calendarId,
          requestBody: fallbackEvent,
          sendUpdates: 'none'
        });
        return created.data;
      }

      // Some calendars reject hangoutsMeet via API ("Invalid conference type value").
      // Retry without conference data - event still gets created, just no Meet link.
      if (typeof message === 'string' && message.includes('Invalid conference type value')) {
        created = await this.calendar.events.insert({
          calendarId,
          requestBody: baseEvent,
          sendUpdates: 'all'
        });
        return created.data;
      }

      // This usually indicates malformed GCP_PRIVATE_KEY formatting in .env.
      if (typeof message === 'string' && message.includes('DECODER routines::unsupported')) {
        const err = new Error('Invalid GCP_PRIVATE_KEY format. Ensure it is copied from service-account JSON and uses \\n for newlines.');
        (err as any).status = 500;
        throw err;
      }

      const err = new Error(message);
      (err as any).status = gStatus || 502;
      throw err;
    }

    return created.data;
  }
}

export default new GoogleCalendarService();
