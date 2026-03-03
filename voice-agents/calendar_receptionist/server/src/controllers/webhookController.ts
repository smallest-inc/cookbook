import { Request, Response, NextFunction } from 'express';
import { fromZonedTime } from 'date-fns-tz';
import googleCalendarService from '../services/googleCalendarService';
import emailService from '../services/emailService';
import { logger } from '../middleware/logger';
import env from '../utils/env';
import { formatIsoRange, formatAvailableSummaryCompact } from '../utils/formatDate';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const BUSINESS_START_HOUR = 9;  // 9 AM
const BUSINESS_END_HOUR = 18;   // 6 PM

/** Convert a date (with local components) to UTC in the calendar timezone. Fixes 3 AM vs 11 AM bug when server runs in UTC. */
function toUtcInCalendarTz(d: Date): Date {
  const tz = env.CALENDAR_TIMEZONE;
  return tz ? fromZonedTime(d, tz) : d;
}

/** Check if a slot falls within business hours (9 AM - 6 PM) in the calendar timezone */
function isWithinBusinessHours(slot: { start: string; end: string }): boolean {
  const tz = env.CALENDAR_TIMEZONE;
  const hourFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: false, timeZone: tz || undefined });
  const toDecHours = (d: Date) => {
    const parts = hourFmt.formatToParts(d);
    return parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10) +
      parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10) / 60;
  };
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  const startH = toDecHours(start);
  const endH = toDecHours(end);
  return startH >= BUSINESS_START_HOUR && endH <= BUSINESS_END_HOUR;
}

/**
 * Atoms/LLM sometimes sends slots with UTC hour = local hour (e.g. 11 AM Pacific sent as 11:00 UTC).
 * If the slot fails business hours but the UTC hour is 9-18, try re-interpreting as Pacific time.
 */
function tryCorrectSlotAsPacific(start: string, end: string): { start: string; end: string } | null {
  const tz = env.CALENDAR_TIMEZONE || 'America/Los_Angeles';
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startHourUtc = startDate.getUTCHours();
  const startMinUtc = startDate.getUTCMinutes();
  const durationMs = endDate.getTime() - startDate.getTime();

  // Only try correction if UTC hour looks like a naive local time (9-18)
  if (startHourUtc < 9 || startHourUtc > 18) return null;

  const y = startDate.getUTCFullYear();
  const m = startDate.getUTCMonth();
  const d = startDate.getUTCDate();
  // Create date with these components interpreted as Pacific
  const localDate = new Date(y, m, d, startHourUtc, startMinUtc, 0, 0);
  const correctedStart = fromZonedTime(localDate, tz);
  const correctedEnd = new Date(correctedStart.getTime() + durationMs);
  const corrected = { start: correctedStart.toISOString(), end: correctedEnd.toISOString() };
  return isWithinBusinessHours(corrected) ? corrected : null;
}

const slotSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime()
}).refine((slot) => new Date(slot.end).getTime() > new Date(slot.start).getTime(), {
  message: 'Each slot must have end after start'
});

const checkAvailabilitySchema = z.object({
  proposedSlots: z.array(slotSchema).default([]),
  targetDay: z.string().optional()
});

const confirmMeetingSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  clientEmail: z.string().email(),
  purpose: z.string().optional(),
  attendeeName: z.string().optional()
}).refine((body) => new Date(body.end).getTime() > new Date(body.start).getTime(), {
  message: 'Meeting end must be after start'
});

// Detect unsubstituted Atoms/Smallest template variables (e.g. "{{day_time_mentioned_by_user}}")
function isUnsubstitutedTemplate(s: string): boolean {
  return /\{\{[^}]*\}\}/.test(s?.trim() || '');
}

// Generate default slots for next N days, 9am–6pm, 30-min intervals (when targetDay is empty/unsubstituted)
// Uses CALENDAR_TIMEZONE so 9 AM = 9 AM in that zone, not server local
function buildDefaultSlots(daysAhead = 3): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];
  const now = new Date();
  const startHour = BUSINESS_START_HOUR;
  const endHour = BUSINESS_END_HOUR;
  const intervalMinutes = 30;

  for (let d = 0; d < daysAhead; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    day.setHours(0, 0, 0, 0);

    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += intervalMinutes) {
        const slotStart = new Date(day);
        slotStart.setHours(h, m, 0, 0);
        const slotStartUtc = toUtcInCalendarTz(slotStart);
        const slotEnd = new Date(slotStartUtc.getTime() + 30 * 60 * 1000);
        if (slotStartUtc.getTime() > now.getTime()) {
          slots.push({ start: slotStartUtc.toISOString(), end: slotEnd.toISOString() });
        }
      }
    }
  }
  return slots.slice(0, 24); // cap at 24 slots to avoid huge responses
}

// webhook called by Smallest.ai receptionist to check availability
export async function handleCheckAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    // expected body: { proposedSlots: [{start, end}], targetDay?: string }
    const parsed = checkAvailabilitySchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid availability payload', details: parsed.error.flatten() });
    }
    let { proposedSlots, targetDay } = parsed.data;

    // Atoms may send literal "{{day_time_mentioned_by_user}}" when variable isn't substituted
    if (targetDay && isUnsubstitutedTemplate(targetDay)) {
      targetDay = undefined;
    }
    const inferredSlots = targetDay ? buildSlotsFromTargetDay(targetDay) : [];
    let slotsToCheck =
      proposedSlots.length > 0
        ? proposedSlots.filter(isWithinBusinessHours)
        : inferredSlots.filter(isWithinBusinessHours);

    const usedDefaultFallback = slotsToCheck.length === 0;
    if (slotsToCheck.length === 0) {
      slotsToCheck = buildDefaultSlots(3);
    }

    logger.info('webhook_check_availability_received', {
      proposedSlots,
      targetDay,
      inferredSlotsCount: inferredSlots.length,
      usedDefaultFallback
    });

    let available = await googleCalendarService.findAvailableSlots(slotsToCheck);
    available = available.filter(isWithinBusinessHours);
    const tz = env.CALENDAR_TIMEZONE;
    // Format slots into human readable strings for the agent to speak (use calendar timezone so times match user's calendar)
    const formatted = (available || []).map((s: any) => formatIsoRange(s.start, s.end, 'en-US', tz));
    // Compact summary for voice: "Friday Feb 27: 11 AM, 11:30 AM, 12 PM" (date said once, not per slot)
    const available_summary = formatAvailableSummaryCompact(available || [], 'en-US', tz);
    // persist formatted availability for frontend polling
    try {
      const outDir = path.resolve(__dirname, '../../outputs');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'availability.json'), JSON.stringify({ available, formatted }, null, 2));
    } catch (e) {
      logger.error('failed_write_availability', { error: (e as any).message });
    }

    // first_slot_*: flat paths for Atoms (avoids $.available[0] which some parsers reject)
    const first = available?.[0];
    res.json({
      available,
      formatted,
      available_summary,
      first_slot_start: first?.start ?? null,
      first_slot_end: first?.end ?? null,
      usedFallback: usedDefaultFallback,
      usedTargetDayInference: inferredSlots.length > 0
    });
  } catch (err) {
    next(err);
  }
}

function buildSlotsFromTargetDay(targetDay: string) {
  const { date: parsedStart, timeExplicit } = parseDayTimeExpression(targetDay);
  if (!parsedStart) return [];
  const baseDate = toUtcInCalendarTz(parsedStart);
  const slots: { start: string; end: string }[] = [];

  if (timeExplicit) {
    // User said "Friday 4 pm" – include requested slot ±2 hours
    const baseMs = baseDate.getTime();
    for (let offset = -120; offset <= 120; offset += 30) {
      const start = new Date(baseMs + offset * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      if (start.getTime() > Date.now()) {
        slots.push({ start: start.toISOString(), end: end.toISOString() });
      }
    }
    return slots.filter(isWithinBusinessHours).slice(0, 9);
  }

  // User said "Friday" without time – generate full business day (9 AM–6 PM)
  // baseDate is already 9 AM on the target day in calendar tz; add hours for 6 PM
  const dayStartUtc = baseDate;
  const dayEndUtc = new Date(baseDate.getTime() + (BUSINESS_END_HOUR - BUSINESS_START_HOUR) * 60 * 60 * 1000);
  const now = Date.now();
  for (let t = dayStartUtc.getTime(); t < dayEndUtc.getTime(); t += 30 * 60 * 1000) {
    const start = new Date(t);
    const end = new Date(t + 30 * 60 * 1000);
    if (start.getTime() > now) {
      slots.push({ start: start.toISOString(), end: end.toISOString() });
    }
  }
  return slots.slice(0, 36); // cap at 18 slots per day (9–6 = 9 hours = 18 slots)
}

function parseDayTimeExpression(input: string): { date: Date | null; timeExplicit: boolean } {
  const s = input.trim().toLowerCase();
  const nil = { date: null as Date | null, timeExplicit: false };
  if (!s) return nil;

  const now = new Date();
  const weekdays: Record<string, number> = {
    sun: 0, sunday: 0,
    mon: 1, monday: 1,
    tue: 2, tues: 2, tuesday: 2,
    wed: 3, wednesday: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4,
    fri: 5, friday: 5,
    sat: 6, saturday: 6
  };

  const timeMatch = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  const timeExplicit = !!timeMatch;
  let hour = 9;
  let minute = 0;
  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = parseInt(timeMatch[2] || '0', 10);
    const ampm = timeMatch[3];
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return nil;
    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
  }

  const ret = (d: Date | null) => d ? { date: d, timeExplicit } : nil;

  // Today / tonight
  if (/\b(today|tonight)\b/.test(s)) {
    const d = new Date(now);
    d.setHours(hour, minute, 0, 0);
    return ret(d.getTime() > now.getTime() ? d : null);
  }

  // Tomorrow
  if (/\btomorrow\b/.test(s)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(hour, minute, 0, 0);
    return ret(d.getTime() > now.getTime() ? d : null);
  }

  // Next Monday, next Friday, next week Monday, etc.
  const nextWeekdayMatch = s.match(/\bnext\s+(?:week\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/);
  if (nextWeekdayMatch) {
    const wd = weekdays[nextWeekdayMatch[1]];
    if (wd !== undefined) {
      const d = new Date(now);
      let daysUntil = (wd - now.getDay() + 7) % 7;
      if (daysUntil === 0) daysUntil = 7; // "next Monday" = next week's Monday
      d.setDate(d.getDate() + daysUntil);
      d.setHours(hour, minute, 0, 0);
      return ret(d.getTime() > now.getTime() ? d : null);
    }
  }

  // Specific date: March 15, March 15th, March 15 2026, 15th of March, Dec 25, next year
  const monthNames: Record<string, number> = {
    jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
    may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
    sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
    dec: 11, december: 11
  };
  const nextYearMatch = s.match(/\bnext\s+year\b/);
  const baseYear = nextYearMatch ? now.getFullYear() + 1 : now.getFullYear();

  let monthNum: number | undefined;
  let dayNum: number | undefined;
  let yearNum = baseYear;
  const monthDayMatch = s.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?\b/i);
  const dayMonthMatch = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s*,?\s*(\d{4}))?\b/i);
  if (monthDayMatch) {
    monthNum = monthNames[monthDayMatch[1].toLowerCase()];
    dayNum = parseInt(monthDayMatch[2], 10);
    if (monthDayMatch[3]) yearNum = parseInt(monthDayMatch[3], 10);
  } else if (dayMonthMatch) {
    dayNum = parseInt(dayMonthMatch[1], 10);
    monthNum = monthNames[dayMonthMatch[2].toLowerCase()];
    if (dayMonthMatch[3]) yearNum = parseInt(dayMonthMatch[3], 10);
  }
  if (monthNum !== undefined && dayNum !== undefined && dayNum >= 1 && dayNum <= 31) {
    let d = new Date(yearNum, monthNum, dayNum, hour, minute, 0, 0);
    if (d.getTime() <= now.getTime()) d.setFullYear(yearNum + 1);
    return ret(d.getTime() > now.getTime() ? d : null);
  }
  const slashMatch = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slashMatch) {
    const [_, m, d, y] = slashMatch;
    const month = parseInt(m, 10) - 1;
    const day = parseInt(d, 10);
    const year = y ? (parseInt(y, 10) < 100 ? 2000 + parseInt(y, 10) : parseInt(y, 10)) : baseYear;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const date = new Date(year, month, day, hour, minute, 0, 0);
      if (date.getTime() <= now.getTime() && !y) date.setFullYear(year + 1);
      return ret(date.getTime() > now.getTime() ? date : null);
    }
  }

  // Weekday only or weekday + time: Friday, Monday 2 pm, Thursday 10 am
  const weekdayMatch = s.match(/\b(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/);
  if (weekdayMatch) {
    const weekday = weekdays[weekdayMatch[1]];
    if (weekday !== undefined) {
      const candidate = new Date(now);
      let dayDelta = (weekday - now.getDay() + 7) % 7;
      candidate.setDate(now.getDate() + dayDelta);
      candidate.setHours(hour, minute, 0, 0);
      if (candidate.getTime() <= now.getTime()) {
        candidate.setDate(candidate.getDate() + 7);
      }
      return ret(candidate.getTime() > now.getTime() ? candidate : null);
    }
  }

  return nil;
}

// Try to fix unsubstituted Atoms variables using last availability response
function tryResolveConfirmMeetingBody(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body };

  // Fix invalid start/end (common when selected_slot_end_iso has trailing space in Atoms - variable doesn't match body)
  const startStr = String(out.start || '');
  const endStr = String(out.end || '');
  if (startStr && endStr && !isUnsubstitutedTemplate(startStr) && !isUnsubstitutedTemplate(endStr)) {
    const startMs = new Date(startStr).getTime();
    const endMs = new Date(endStr).getTime();
    const durationMs = endMs - startMs;
    const thirtyMinMs = 30 * 60 * 1000;
    if (durationMs <= 0 || durationMs > thirtyMinMs) {
      const fixedEnd = new Date(startMs + thirtyMinMs);
      out.end = fixedEnd.toISOString();
      logger.info('confirm_meeting_fixed_slot_duration', {
        original: { start: startStr, end: endStr },
        fixedEnd: out.end,
        reason: durationMs <= 0 ? 'identical' : 'slot_must_be_30_min'
      });
    }
  }

  // If start/end are unsubstituted, try last availability (first slot)
  if (isUnsubstitutedTemplate(String(body.start || '')) || isUnsubstitutedTemplate(String(body.end || ''))) {
    try {
      const availPath = path.join(path.resolve(__dirname, '../../outputs'), 'availability.json');
      if (fs.existsSync(availPath)) {
        const data = JSON.parse(fs.readFileSync(availPath, 'utf-8'));
        const slots = data?.available || data?.formatted;
        if (Array.isArray(slots) && slots.length > 0) {
          const first = slots[0];
          if (first?.start && first?.end) {
            out.start = first.start;
            out.end = first.end;
            logger.info('confirm_meeting_used_last_availability_fallback', { slot: first });
          }
        }
      }
    } catch (e) {
      logger.warn('confirm_meeting_fallback_read_failed', { error: (e as Error).message });
    }
  }

  // If clientEmail is unsubstituted, use placeholder so event can be created (fix Atoms config for real emails)
  if (isUnsubstitutedTemplate(String(body.clientEmail || ''))) {
    out.clientEmail = 'guest@example.com';
    logger.info('confirm_meeting_used_client_email_fallback');
  }

  // If purpose is unsubstituted, use default so calendar event doesn't show "{{meeting_purpose}}"
  if (isUnsubstitutedTemplate(String(body.purpose || ''))) {
    out.purpose = 'Meeting via Receptionist';
    logger.info('confirm_meeting_used_purpose_fallback');
  }

  // If attendeeName is unsubstituted, use default so it doesn't show "{{caller_name}}"
  if (isUnsubstitutedTemplate(String(body.attendeeName || ''))) {
    out.attendeeName = 'Guest';
    logger.info('confirm_meeting_used_attendee_name_fallback');
  }

  return out;
}

// webhook called by Smallest.ai receptionist when meeting is confirmed
export async function handleConfirmMeeting(req: Request, res: Response, next: NextFunction) {
  try {
    /* expected body:
      {
        start: 'ISO string',
        end: 'ISO string',
        clientEmail: 'client@example.com',
        purpose: 'Discuss project',
        attendeeName: 'Alice'
      }
    */
    let body = req.body || {};
    if (typeof body === 'object') {
      body = tryResolveConfirmMeetingBody(body);
    }

    const parsed = confirmMeetingSchema.safeParse(body);
    if (!parsed.success) {
      const details = parsed.error.flatten();
      const unsubstituted: string[] = [];
      for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
        if (typeof v === 'string' && isUnsubstitutedTemplate(v)) unsubstituted.push(k);
      }
      if (unsubstituted.length > 0) {
        return res.status(400).json({
          error: 'Invalid confirm meeting payload',
          hint: 'Atoms sent unsubstituted template variables. In your confirmMeeting API function, add LLM parameters for: selected_slot_start_iso, selected_slot_end_iso, client_email, caller_name. Map slot from getAvailableSlots response (e.g. first_slot_start) and extract email/name from user input.',
          unsubstitutedFields: unsubstituted,
          details,
          confirmationMessage: "I'm sorry, I couldn't complete the booking. Could you please tell me your email and preferred time again?"
        });
      }
      const hint =
        details.formErrors?.includes('Meeting end must be after start')
          ? 'Check Atoms: variable selected_slot_end_iso must have NO trailing space. Body must use {{selected_slot_end_iso}} for end.'
          : undefined;
      return res.status(400).json({
        error: 'Invalid confirm meeting payload',
        details,
        ...(hint && { hint }),
        confirmationMessage: "I'm sorry, I couldn't complete the booking. Would you like to try again with a different time?"
      });
    }

    let { start, end, clientEmail, purpose, attendeeName } = parsed.data;
    logger.info('webhook_confirm_meeting_received', { start, end, clientEmail, purpose });

    // Business hours: 9 AM - 6 PM only (in calendar timezone = Pacific)
    if (!isWithinBusinessHours({ start, end })) {
      // Atoms/LLM sometimes sends "11 AM" as 11:00 UTC instead of 11 AM Pacific. Try to fix.
      const corrected = tryCorrectSlotAsPacific(start, end);
      if (corrected) {
        logger.info('confirm_meeting_slot_corrected_from_utc_to_pacific', { original: { start, end }, corrected });
        start = corrected.start;
        end = corrected.end;
      } else {
        return res.status(400).json({
          ok: false,
          error: 'Appointments can only be scheduled between 9 AM and 6 PM.',
          confirmationMessage: "I'm sorry, appointments can only be scheduled between 9 AM and 6 PM. Would you like to choose a different time?"
        });
      }
    }

    // Safety gate: never create an event if the requested slot is busy.
    const requestedSlot = [{ start, end }];
    const availableForRequestedSlot = await googleCalendarService.findAvailableSlots(requestedSlot);
    if (availableForRequestedSlot.length === 0) {
      return res.status(409).json({
        ok: false,
        error: 'Requested slot is unavailable. Please choose another time.',
        confirmationMessage: "I'm sorry, that time slot is no longer available. Would you like me to check other times?"
      });
    }

    const event = await googleCalendarService.createEvent({
      start: new Date(start),
      end: new Date(end),
      summary: purpose || 'Meeting via Receptionist',
      description: `With: ${attendeeName || 'Caller'} (${clientEmail})`,
      attendees: [{ email: clientEmail, displayName: attendeeName }]
    });

    let emailResult: { sent: boolean; reason?: string } = { sent: false };
    try {
      const receiverEmail = env.GCP_SUBJECT_EMAIL || env.GCP_CLIENT_EMAIL;
      const meetLink = event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri;
      emailResult = await emailService.sendBookingConfirmation({
        to: [clientEmail, receiverEmail],
        attendeeName,
        summary: purpose || 'Meeting via Receptionist',
        startIso: start,
        endIso: end,
        eventLink: event.htmlLink || undefined,
        meetLink: meetLink || undefined,
        organizerEmail: receiverEmail,
        organizerName: 'Malikaa'
      });
    } catch (emailErr: any) {
      emailResult = { sent: false, reason: emailErr?.message || 'unknown' };
      logger.error('booking_confirmation_email_failed', {
        message: emailErr?.message,
        to: clientEmail,
        code: emailErr?.code
      });
    }

    // persist last created event for frontend
    try {
      const outDir = path.resolve(__dirname, '../../outputs');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'lastEvent.json'), JSON.stringify(event, null, 2));
    } catch (e) {
      logger.error('failed_write_event', { error: (e as any).message });
    }

    const readableTime = formatIsoRange(start, end, 'en-US', env.CALENDAR_TIMEZONE).readable;
    const confirmationMessage = `Your meeting is confirmed for ${readableTime}. You'll receive a calendar invite at ${clientEmail}.`;

    res.json({
      ok: true,
      event,
      email: emailResult,
      confirmationMessage
    });
  } catch (err) {
    next(err);
  }
}

export default { handleCheckAvailability, handleConfirmMeeting };
