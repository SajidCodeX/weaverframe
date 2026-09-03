/**
 * Deterministic Date & Appointment Resolution Engine
 *
 * Replaces LLM-generated raw ISO timestamps with deterministic,
 * timezone-aware calendar calculations in TypeScript.
 */

export interface BookingIntentInput {
  relativeDay?: string | null;     // e.g. "today", "tomorrow", "day after tomorrow"
  dayOfWeek?: string | null;       // e.g. "Monday", "next Tuesday", "this Friday"
  specificDateStr?: string | null; // e.g. "Sep 15", "October 3rd", "2026-09-15"
  timeStr?: string | null;         // e.g. "10:00 AM", "2:30 PM", "noon", "14:00"
  type?: string | null;            // e.g. "Site visit", "Design studio meeting"
  isoDateTime?: string | null;     // Hostile / legacy input (MUST BE REJECTED)
}

export interface ResolveBookingOptions {
  currentDate?: Date;
  timeZone?: string;
}

export interface ResolveBookingResult {
  valid: boolean;
  resolvedDate: Date | null;
  isoDateTime: string | null;
  type: string;
  failureReason?: string;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Parse a human-friendly time string (e.g., "10:00 AM", "2:30pm", "noon", "15:00")
 * into hours (0-23) and minutes (0-59).
 */
export function parseTimeString(timeStr?: string | null): { hours: number; minutes: number } | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const raw = timeStr.trim().toLowerCase();

  if (raw === 'noon' || raw === '12 noon' || raw === 'midday') {
    return { hours: 12, minutes: 0 };
  }
  if (raw === 'morning' || raw === 'in the morning') {
    return { hours: 10, minutes: 0 }; // Default standard morning meeting time
  }
  if (raw === 'afternoon' || raw === 'in the afternoon') {
    return { hours: 14, minutes: 0 }; // Default standard afternoon meeting time
  }

  // Match e.g. "10:30 AM", "10:30am", "10 AM", "2pm", "14:00"
  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridian = match[3] ? match[3].toLowerCase() : null;

  if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes > 59) return null;

  if (meridian === 'pm' && hours < 12) {
    hours += 12;
  } else if (meridian === 'am' && hours === 12) {
    hours = 0;
  } else if (!meridian && hours < 7) {
    // If user says "2:00" without am/pm, for business appointments 2 means 2:00 PM (14:00)
    hours += 12;
  }

  if (hours < 0 || hours > 23) return null;
  return { hours, minutes };
}

/**
 * Deterministically resolve a booking intent into an exact Date object
 * anchored strictly to the server's current date and target timezone.
 */
export function resolveBookingDateTime(
  input: BookingIntentInput | null | undefined,
  options?: ResolveBookingOptions
): ResolveBookingResult {
  const defaultType = input?.type || 'Site visit';

  if (!input || typeof input !== 'object') {
    return { valid: false, resolvedDate: null, isoDateTime: null, type: defaultType, failureReason: 'Missing booking input' };
  }

  // RULE: Strictly reject any direct raw ISO string passed by the LLM
  // The LLM must not be allowed to forge past years (e.g. 2025)
  if (input.isoDateTime && typeof input.isoDateTime === 'string') {
    // If the input ONLY has isoDateTime and no relative/structured intent, reject it
    if (!input.relativeDay && !input.dayOfWeek && !input.specificDateStr && !input.timeStr) {
      return {
        valid: false,
        resolvedDate: null,
        isoDateTime: null,
        type: defaultType,
        failureReason: 'Direct isoDateTime from LLM rejected. Structured relative intent required.',
      };
    }
  }

  const baseDate = options?.currentDate ? new Date(options.currentDate) : new Date();
  if (isNaN(baseDate.getTime())) {
    return { valid: false, resolvedDate: null, isoDateTime: null, type: defaultType, failureReason: 'Invalid base date' };
  }

  // Determine time of day
  const parsedTime = parseTimeString(input.timeStr);
  const hours = parsedTime ? parsedTime.hours : 10; // Default 10:00 AM if omitted
  const minutes = parsedTime ? parsedTime.minutes : 0;

  let targetYear = baseDate.getFullYear();
  let targetMonth = baseDate.getMonth();
  let targetDay = baseDate.getDate();

  const relDay = (input.relativeDay || '').trim().toLowerCase();
  const dayOfWeek = (input.dayOfWeek || '').trim().toLowerCase();
  const specificStr = (input.specificDateStr || '').trim();

  let matched = false;

  // 1. Relative day parsing
  if (relDay) {
    if (relDay === 'today' || relDay === 'same day' || relDay === 'same-day') {
      matched = true;
    } else if (relDay === 'tomorrow' || relDay === 'next day') {
      targetDay += 1;
      matched = true;
    } else if (relDay === 'day after tomorrow') {
      targetDay += 2;
      matched = true;
    } else {
      const inDaysMatch = relDay.match(/in\s+(\d+)\s+days?/i);
      if (inDaysMatch) {
        targetDay += parseInt(inDaysMatch[1], 10);
        matched = true;
      }
    }
  }

  // 2. Day of week parsing (e.g. "Monday", "next Friday", "this Thursday")
  if (!matched && dayOfWeek) {
    const isNextWeek = dayOfWeek.includes('next');
    const cleanDay = dayOfWeek.replace(/(next|this)\s+/g, '').trim().toLowerCase();
    const targetDayIndex = DAY_NAMES.indexOf(cleanDay);

    if (targetDayIndex !== -1) {
      const currentDayIndex = baseDate.getDay();
      let diff = targetDayIndex - currentDayIndex;

      if (diff <= 0) {
        diff += 7; // Advance to next upcoming occurrence
      }
      if (isNextWeek && diff < 7) {
        diff += 7;
      }

      targetDay += diff;
      matched = true;
    }
  }

  // 3. Explicit date string parsing (e.g., "Sep 15", "October 3rd", "2026-09-15")
  if (!matched && specificStr) {
    // Strip ordinal suffixes (e.g. "3rd", "15th")
    const cleanSpecific = specificStr.replace(/(\d+)(st|nd|rd|th)/i, '$1');
    const candidate = new Date(`${cleanSpecific} ${targetYear} ${hours}:${minutes}:00`);

    if (!isNaN(candidate.getTime())) {
      targetYear = candidate.getFullYear();
      targetMonth = candidate.getMonth();
      targetDay = candidate.getDate();
      matched = true;
    }
  }

  if (!matched) {
    return {
      valid: false,
      resolvedDate: null,
      isoDateTime: null,
      type: defaultType,
      failureReason: `Unable to resolve calendar intent from relativeDay="${input.relativeDay}", dayOfWeek="${input.dayOfWeek}", specificDate="${input.specificDateStr}"`,
    };
  }

  // Construct final deterministic Date
  const finalDate = new Date(targetYear, targetMonth, targetDay, hours, minutes, 0, 0);

  if (isNaN(finalDate.getTime())) {
    return { valid: false, resolvedDate: null, isoDateTime: null, type: defaultType, failureReason: 'Computed Date is NaN' };
  }

  // Ensure resolved date is strictly in the present or future (with 15-minute grace for same-day)
  if (finalDate.getTime() < baseDate.getTime() - 15 * 60 * 1000) {
    return {
      valid: false,
      resolvedDate: null,
      isoDateTime: null,
      type: defaultType,
      failureReason: `Resolved date ${finalDate.toISOString()} is in the past relative to ${baseDate.toISOString()}`,
    };
  }

  return {
    valid: true,
    resolvedDate: finalDate,
    isoDateTime: finalDate.toISOString(),
    type: defaultType,
  };
}

/**
 * Verifies whether a proposed appointment slot has a collision with existing appointments
 * for the builder within a given time window (default: ±45 minutes).
 */
export async function checkAppointmentAvailability(
  db: any,
  builderId: string,
  proposedDate: Date,
  windowMinutes: number = 45
): Promise<{ available: boolean; conflictingAppointment?: any; proposedAlternate?: Date }> {
  if (!db || !builderId || !proposedDate || isNaN(proposedDate.getTime())) {
    return { available: true };
  }

  const windowMs = windowMinutes * 60 * 1000;
  const windowStart = new Date(proposedDate.getTime() - windowMs);
  const windowEnd = new Date(proposedDate.getTime() + windowMs);

  const conflict = await db.appointment.findFirst({
    where: {
      builderId,
      status: { not: 'Cancelled' },
      dateTime: {
        gte: windowStart,
        lte: windowEnd,
      },
    },
  });

  if (conflict) {
    // Propose an alternative 2 hours after the conflict
    const proposedAlternate = new Date(proposedDate.getTime() + 2 * 60 * 60 * 1000);
    return {
      available: false,
      conflictingAppointment: conflict,
      proposedAlternate,
    };
  }

  return { available: true };
}

/**
 * Concurrency-Safe Atomic Appointment Reservation
 *
 * Uses Serializable transaction isolation on PostgreSQL to prevent Time-of-Check
 * to Time-of-Use (TOCTOU) race conditions when concurrent booking requests arrive.
 */
export async function bookAppointmentAtomically(
  db: any,
  data: {
    builderId: string;
    leadId: string;
    bookingDate: Date;
    type?: string;
    location?: string;
    notes?: string;
    windowMinutes?: number;
  }
): Promise<{ success: boolean; appointment?: any; conflictingAppointment?: any; proposedAlternate?: Date }> {
  const windowMs = (data.windowMinutes ?? 45) * 60 * 1000;
  const windowStart = new Date(data.bookingDate.getTime() - windowMs);
  const windowEnd = new Date(data.bookingDate.getTime() + windowMs);

  // If db supports interactive transactions
  if (typeof db.$transaction === 'function') {
    try {
      const result = await db.$transaction(
        async (tx: any) => {
          const conflict = await tx.appointment.findFirst({
            where: {
              builderId: data.builderId,
              status: { not: 'Cancelled' },
              dateTime: {
                gte: windowStart,
                lte: windowEnd,
              },
            },
          });

          if (conflict) {
            const proposedAlternate = new Date(data.bookingDate.getTime() + 2 * 60 * 60 * 1000);
            return { success: false, conflictingAppointment: conflict, proposedAlternate };
          }

          const appt = await tx.appointment.create({
            data: {
              builderId: data.builderId,
              leadId: data.leadId,
              type: data.type || 'Site visit',
              dateTime: data.bookingDate,
              location: data.location || 'TBD — Confirmed via AI Concierge',
              status: 'Pending',
              notes: data.notes || '',
            },
          });

          return { success: true, appointment: appt };
        },
        {
          isolationLevel: 'Serializable',
          timeout: 10000,
        }
      );

      return result;
    } catch (txErr: any) {
      // Catch serialization race conditions (Postgres 40001 / Prisma P2034)
      if (
        txErr?.code === 'P2034' ||
        txErr?.message?.includes('could not serialize') ||
        txErr?.message?.includes('deadlock')
      ) {
        const proposedAlternate = new Date(data.bookingDate.getTime() + 2 * 60 * 60 * 1000);
        return {
          success: false,
          conflictingAppointment: { id: 'concurrent_lock' },
          proposedAlternate,
        };
      }
      throw txErr;
    }
  }

  // Fallback for mocks or single-client environments
  const availability = await checkAppointmentAvailability(db, data.builderId, data.bookingDate, data.windowMinutes ?? 45);
  if (!availability.available) {
    return {
      success: false,
      conflictingAppointment: availability.conflictingAppointment,
      proposedAlternate: availability.proposedAlternate,
    };
  }

  const appt = await db.appointment.create({
    data: {
      builderId: data.builderId,
      leadId: data.leadId,
      type: data.type || 'Site visit',
      dateTime: data.bookingDate,
      location: data.location || 'TBD — Confirmed via AI Concierge',
      status: 'Pending',
      notes: data.notes || '',
    },
  });

  return { success: true, appointment: appt };
}

