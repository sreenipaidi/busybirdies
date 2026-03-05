/**
 * Business hours configuration used for SLA calculations.
 */
export interface BusinessHours {
  /** Start time in "HH:mm" format, e.g. "09:00" */
  start: string;
  /** End time in "HH:mm" format, e.g. "17:00" */
  end: string;
  /** IANA timezone string, e.g. "UTC" or "America/New_York" */
  timezone: string;
  /** Comma-separated day numbers where 0=Sunday, 1=Monday, ..., 6=Saturday, e.g. "1,2,3,4,5" */
  days: string;
}

/**
 * Parse an "HH:mm" time string into hours and minutes.
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [h, m] = timeStr.split(':').map(Number);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

/**
 * Get business day numbers from the days string (e.g. "1,2,3,4,5" -> [1,2,3,4,5]).
 */
function getBusinessDays(days: string): number[] {
  return days.split(',').map((d) => parseInt(d.trim(), 10)).filter((d) => !isNaN(d));
}

/**
 * Get the number of business minutes in a single business day.
 */
function getBusinessDayMinutes(bh: BusinessHours): number {
  const start = parseTime(bh.start);
  const end = parseTime(bh.end);
  return (end.hours * 60 + end.minutes) - (start.hours * 60 + start.minutes);
}

/**
 * Calculate an SLA deadline by adding the given number of business-hours minutes
 * to a start time, taking into account business hours and business days.
 *
 * If the start time falls outside business hours, the timer begins at the next
 * business-hours window.
 *
 * @param startTime - The start timestamp (when the ticket was created)
 * @param minutes - Number of business-hours minutes until the deadline
 * @param businessHours - Business hours configuration
 * @returns The deadline Date
 */
export function calculateDeadline(
  startTime: Date,
  minutes: number,
  businessHours: BusinessHours,
): Date {
  if (minutes <= 0) {
    return new Date(startTime);
  }

  const businessDays = getBusinessDays(businessHours.days);
  const startBh = parseTime(businessHours.start);
  const endBh = parseTime(businessHours.end);
  const dailyMinutes = getBusinessDayMinutes(businessHours);

  if (dailyMinutes <= 0 || businessDays.length === 0) {
    // No business hours configured, fall back to calendar minutes
    return new Date(startTime.getTime() + minutes * 60 * 1000);
  }

  let remainingMinutes = minutes;

  // Work in UTC for simplicity -- the business hours are treated as if
  // they are in UTC. This is a simplification; a production system would
  // convert to the configured timezone.
  const cursor = new Date(startTime);

  // Advance cursor to the next business window if currently outside
  cursor.setTime(advanceToBusinessWindow(cursor, businessDays, startBh, endBh).getTime());

  while (remainingMinutes > 0) {
    const dayOfWeek = cursor.getUTCDay();
    if (!businessDays.includes(dayOfWeek)) {
      // Not a business day, advance to next day start of business
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(startBh.hours, startBh.minutes, 0, 0);
      continue;
    }

    const currentMinuteOfDay = cursor.getUTCHours() * 60 + cursor.getUTCMinutes();
    const endMinuteOfDay = endBh.hours * 60 + endBh.minutes;

    const minutesLeftInDay = endMinuteOfDay - currentMinuteOfDay;

    if (minutesLeftInDay <= 0) {
      // Past business hours, advance to next day
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(startBh.hours, startBh.minutes, 0, 0);
      continue;
    }

    if (remainingMinutes <= minutesLeftInDay) {
      // Deadline falls within this business day
      cursor.setTime(cursor.getTime() + remainingMinutes * 60 * 1000);
      remainingMinutes = 0;
    } else {
      // Consume the rest of this day and move to next
      remainingMinutes -= minutesLeftInDay;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(startBh.hours, startBh.minutes, 0, 0);
    }
  }

  return cursor;
}

/**
 * Advance a date to the next business hours window if it is currently
 * outside of business hours.
 */
function advanceToBusinessWindow(
  date: Date,
  businessDays: number[],
  startBh: { hours: number; minutes: number },
  endBh: { hours: number; minutes: number },
): Date {
  const cursor = new Date(date);
  const startMin = startBh.hours * 60 + startBh.minutes;
  const endMin = endBh.hours * 60 + endBh.minutes;

  // Max iterations to prevent infinite loop (7 days * 2 should be enough)
  for (let i = 0; i < 14; i++) {
    const dayOfWeek = cursor.getUTCDay();
    const currentMin = cursor.getUTCHours() * 60 + cursor.getUTCMinutes();

    if (businessDays.includes(dayOfWeek)) {
      if (currentMin < startMin) {
        // Before business hours start -- move to start
        cursor.setUTCHours(startBh.hours, startBh.minutes, 0, 0);
        return cursor;
      }
      if (currentMin < endMin) {
        // Within business hours
        return cursor;
      }
      // After business hours, fall through to advance to next day
    }

    // Advance to next day, start of business
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(startBh.hours, startBh.minutes, 0, 0);
  }

  return cursor;
}

/**
 * Check whether a given timestamp is within business hours.
 */
export function isWithinBusinessHours(
  time: Date,
  businessHours: BusinessHours,
): boolean {
  const businessDays = getBusinessDays(businessHours.days);
  const startBh = parseTime(businessHours.start);
  const endBh = parseTime(businessHours.end);

  const dayOfWeek = time.getUTCDay();
  if (!businessDays.includes(dayOfWeek)) {
    return false;
  }

  const currentMin = time.getUTCHours() * 60 + time.getUTCMinutes();
  const startMin = startBh.hours * 60 + startBh.minutes;
  const endMin = endBh.hours * 60 + endBh.minutes;

  return currentMin >= startMin && currentMin < endMin;
}

/**
 * Calculate the number of business-hours minutes that have elapsed between two timestamps.
 * Useful for determining whether an SLA target was met.
 */
export function getBusinessMinutesElapsed(
  startTime: Date,
  endTime: Date,
  businessHours: BusinessHours,
): number {
  if (endTime <= startTime) {
    return 0;
  }

  const businessDays = getBusinessDays(businessHours.days);
  const startBh = parseTime(businessHours.start);
  const endBh = parseTime(businessHours.end);
  const dailyMinutes = getBusinessDayMinutes(businessHours);

  if (dailyMinutes <= 0 || businessDays.length === 0) {
    return Math.floor((endTime.getTime() - startTime.getTime()) / 60000);
  }

  let totalMinutes = 0;
  const cursor = new Date(startTime);

  // Advance to business hours if needed
  cursor.setTime(
    advanceToBusinessWindow(cursor, businessDays, startBh, endBh).getTime(),
  );

  const startMin = startBh.hours * 60 + startBh.minutes;
  const endMin = endBh.hours * 60 + endBh.minutes;

  while (cursor < endTime) {
    const dayOfWeek = cursor.getUTCDay();
    if (!businessDays.includes(dayOfWeek)) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(startBh.hours, startBh.minutes, 0, 0);
      continue;
    }

    const currentMin = cursor.getUTCHours() * 60 + cursor.getUTCMinutes();

    if (currentMin >= endMin) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(startBh.hours, startBh.minutes, 0, 0);
      continue;
    }

    if (currentMin < startMin) {
      cursor.setUTCHours(startBh.hours, startBh.minutes, 0, 0);
      continue;
    }

    // We are within business hours. Calculate minutes until end of day or endTime, whichever is sooner
    const endOfDayCursor = new Date(cursor);
    endOfDayCursor.setUTCHours(endBh.hours, endBh.minutes, 0, 0);

    const effectiveEnd = endTime < endOfDayCursor ? endTime : endOfDayCursor;
    const elapsedMs = effectiveEnd.getTime() - cursor.getTime();
    const elapsedMin = Math.max(0, Math.floor(elapsedMs / 60000));

    totalMinutes += elapsedMin;

    // Advance to next day
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    cursor.setUTCHours(startBh.hours, startBh.minutes, 0, 0);
  }

  return totalMinutes;
}
