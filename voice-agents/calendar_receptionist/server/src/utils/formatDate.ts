/** Format time for TTS: "9 AM" not "9:00 AM" (avoids "nine colon zero zero"), "11:30 AM" for half hours */
function formatTimeForVoice(d: Date, locale: string, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    timeZone
  }).formatToParts(d);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '0';
  const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value ?? '';
  const minNum = parseInt(minute, 10) || 0;
  if (minNum === 0) return `${hour} ${dayPeriod}`;
  return `${hour}:${minute} ${dayPeriod}`;
}

export function formatSlotReadable(startIso: string, endIso: string, locale = 'en-US', timeZone?: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const dayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric', timeZone });
  const day = dayFormatter.format(start);
  const startTime = formatTimeForVoice(start, locale, timeZone);
  const endTime = formatTimeForVoice(end, locale, timeZone);

  return `${day}, ${startTime} - ${endTime}`;
}

export function formatIsoRange(startIso: string, endIso: string, locale = 'en-US', timeZone?: string) {
  return {
    start: startIso,
    end: endIso,
    readable: formatSlotReadable(startIso, endIso, locale, timeZone)
  };
}

/**
 * Compact summary for voice: "Friday Feb 27: There is availability from 9 AM to 11 AM"
 * Groups slots by day and outputs a time range instead of listing each slot.
 * When a day has availability spanning 9 AM to 5 PM, says "There is availability from 9 AM to 5 PM".
 */
export function formatAvailableSummaryCompact(
  slots: Array<{ start: string; end: string }>,
  locale = 'en-US',
  timeZone?: string
): string {
  if (!slots?.length) return 'No slots available';

  const sortedSlots = [...slots].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'short', day: 'numeric', timeZone });

  const hourFmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: 'numeric', hour12: false, timeZone: timeZone || undefined });
  const toDecHours = (d: Date) => {
    const parts = hourFmt.formatToParts(d);
    return parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10) +
      parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10) / 60;
  };
  const byDay = new Map<string, { dayLabel: string; firstStartIso: string; lastEndIso: string; minStartH: number; maxEndH: number; slotCount: number; times: string[] }>();
  for (const s of sortedSlots) {
    const start = new Date(s.start);
    const end = new Date(s.end);
    const dayKey = start.toISOString().slice(0, 10);
    const dayLabel = dayFmt.format(start);
    const timeStr = formatTimeForVoice(start, locale, timeZone);
    const minStartH = toDecHours(start);
    const maxEndH = toDecHours(end);

    if (!byDay.has(dayKey)) {
      byDay.set(dayKey, { dayLabel, firstStartIso: s.start, lastEndIso: s.end, minStartH, maxEndH, slotCount: 1, times: [timeStr] });
    } else {
      const entry = byDay.get(dayKey)!;
      if (minStartH < entry.minStartH) entry.firstStartIso = s.start;
      if (maxEndH > entry.maxEndH) entry.lastEndIso = s.end;
      entry.minStartH = Math.min(entry.minStartH, minStartH);
      entry.maxEndH = Math.max(entry.maxEndH, maxEndH);
      entry.slotCount += 1;
      if (entry.times[entry.times.length - 1] !== timeStr) entry.times.push(timeStr);
    }
  }

  const parts: string[] = [];
  for (const [, entry] of byDay) {
    const { dayLabel, firstStartIso, lastEndIso, minStartH, maxEndH, slotCount, times } = entry;
    const startStr = formatTimeForVoice(new Date(firstStartIso), locale, timeZone);
    const endStr = formatTimeForVoice(new Date(lastEndIso), locale, timeZone);
    // Continuous = slots fill the range (each slot 30 min)
    const spanHours = maxEndH - minStartH;
    const isContinuous = Math.abs(spanHours - slotCount * 0.5) < 0.01;
    const isAllDay = minStartH <= 9.5 && maxEndH >= 18;
    if (isAllDay) {
      parts.push(`${dayLabel}: There is availability from 9 AM to 6 PM`);
    } else if (isContinuous) {
      parts.push(`${dayLabel}: There is availability from ${startStr} to ${endStr}`);
    } else {
      parts.push(`${dayLabel}: ${times.join(', ')}`);
    }
  }
  return parts.join('; ');
}
