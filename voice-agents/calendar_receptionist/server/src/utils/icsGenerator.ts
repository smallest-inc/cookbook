/**
 * Generate .ics (iCalendar) content for a calendar invite.
 * Attaching this to emails lets recipients add the event to their calendar.
 */
function escapeIcsValue(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toIcsDateTime(iso: string): string {
  return iso.replace(/[-:]/g, '').replace(/\.\d+/, '');
}

export function generateIcs(params: {
  summary: string;
  startIso: string;
  endIso: string;
  uid?: string;
  description?: string;
  meetLink?: string;
  organizerEmail: string;
  organizerName?: string;
  attendeeEmail: string;
  attendeeName?: string;
}): string {
  const { summary, startIso, endIso, uid, description, meetLink, organizerEmail, organizerName, attendeeEmail, attendeeName } = params;
  const dtStart = toIcsDateTime(startIso);
  const dtEnd = toIcsDateTime(endIso);
  const dtStamp = toIcsDateTime(new Date().toISOString());
  const eventUid = uid || `meeting-${Date.now()}-${Math.random().toString(36).slice(2)}@calendar-receptionist`;

  const organizerLine = organizerName
    ? `ORGANIZER;CN="${escapeIcsValue(organizerName)}":mailto:${organizerEmail}`
    : `ORGANIZER:mailto:${organizerEmail}`;
  const attendeeLine = attendeeName
    ? `ATTENDEE;CN="${escapeIcsValue(attendeeName)}";RSVP=TRUE:mailto:${attendeeEmail}`
    : `ATTENDEE;RSVP=TRUE:mailto:${attendeeEmail}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Calendar Receptionist//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${eventUid}`,
    `DTSTAMP:${dtStamp}Z`,
    `DTSTART:${dtStart}Z`,
    `DTEND:${dtEnd}Z`,
    organizerLine,
    attendeeLine,
    `SUMMARY:${escapeIcsValue(summary)}`,
    ...(meetLink ? [`LOCATION:${escapeIcsValue(meetLink)}`, `URL:${meetLink}`] : []),
    ...(description ? [`DESCRIPTION:${escapeIcsValue(description)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR'
  ];

  return lines.join('\r\n');
}
