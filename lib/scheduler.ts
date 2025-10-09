import { prisma } from './prisma';
import { addHours, addMinutes, format, isWithinInterval, setHours, setMinutes } from 'date-fns';

interface ShiftConfig {
  startHour: number;
  endHour: number;
  posts: string[];
  peoplePerPost: number;
  shiftType: 'day' | 'night';
}

const DAY_SHIFT_CONFIG: ShiftConfig = {
  startHour: 8,
  endHour: 19,
  posts: ['Gate', 'North', 'West'],
  peoplePerPost: 1,
  shiftType: 'day'
};

const NIGHT_SHIFT_CONFIG: ShiftConfig = {
  startHour: 19,
  endHour: 9, // next day
  posts: ['Gate', 'North'],
  peoplePerPost: 2,
  shiftType: 'night'
};

/**
 * Gets the guard with the lowest total hours who is active
 */
async function getNextAvailableGuard(
  periodId: string,
  excludeIds: string[] = []
): Promise<string | null> {
  // Get the guard with minimum hours
  const guard = await prisma.guard.findFirst({
    where: {
      periodId,
      isActive: true,
      id: { notIn: excludeIds }
    },
    orderBy: {
      totalHours: 'asc'
    }
  });

  return guard?.id ?? null;
}

/**
 * Generates all shifts for a guard period based on the shift length
 */
export async function generateShiftsForPeriod(periodId: string): Promise<void> {
  const period = await prisma.guardPeriod.findUnique({
    where: { id: periodId },
    include: { guards: true, activities: true }
  });

  if (!period) throw new Error('Period not found');

  interface ShiftInput {
    startTime: Date;
    endTime: Date;
    postType: string;
    shiftType: 'day' | 'night';
    peopleCount: number;
    periodId: string;
  }

  const shifts: ShiftInput[] = [];
  let currentTime = new Date(period.startDate);
  const endTime = new Date(period.endDate);
  const shiftLengthHours = period.shiftLength;

  while (currentTime < endTime) {
    const hour = currentTime.getHours();

    // Check if we're in an activity session (skip normal shift generation)
    const isInActivity = period.activities.some(activity =>
      activity.endTime === null && // Activity is still running
      isWithinInterval(currentTime, {
        start: new Date(activity.startTime),
        end: new Date() // Current time if activity is still running
      })
    );

    if (isInActivity) {
      // Skip to next shift length
      currentTime = addHours(currentTime, shiftLengthHours);
      continue;
    }

    // Determine if we're in day or night shift
    const config = (hour >= 8 && hour < 19) ? DAY_SHIFT_CONFIG : NIGHT_SHIFT_CONFIG;

    // Generate shifts for each post
    for (const post of config.posts) {
      for (let i = 0; i < config.peoplePerPost; i++) {
        const shiftEnd = addHours(currentTime, shiftLengthHours);

        shifts.push({
          startTime: new Date(currentTime),
          endTime: shiftEnd,
          postType: post,
          shiftType: config.shiftType,
          peopleCount: config.peoplePerPost,
          periodId
        });
      }
    }

    currentTime = addHours(currentTime, shiftLengthHours);
  }

  // Create shifts in database (without guard assignments yet)
  await prisma.shift.createMany({
    data: shifts
  });

  // Now assign guards to all shifts
  await assignGuardsToShifts(periodId);

  // Generate morning readiness shifts
  await generateMorningReadinessShifts(periodId);
}

/**
 * Assigns guards to all unassigned shifts in a period, balancing by total_hours
 * Uses round-based rotation to ensure fair distribution and variety
 */
export async function assignGuardsToShifts(
  periodId: string,
  startFrom?: Date
): Promise<void> {
  // Get all unassigned shifts (optionally from a specific time forward)
  const whereClause: {
    periodId: string;
    guardId: null;
    isSpecial: false;
    startTime?: { gte: Date };
  } = {
    periodId,
    guardId: null,
    isSpecial: false // Don't auto-assign special shifts
  };

  if (startFrom) {
    whereClause.startTime = { gte: startFrom };
  }

  const unassignedShifts = await prisma.shift.findMany({
    where: whereClause,
    orderBy: { startTime: 'asc' }
  });

  // Get all active guards for this period
  const allGuards = await prisma.guard.findMany({
    where: { periodId, isActive: true }
  });

  // P1-2: Optimize by fetching all assigned shifts once (fix N+1 query problem)
  const allAssignedShifts = await prisma.shift.findMany({
    where: {
      periodId,
      guardId: { not: null }
    },
    select: {
      guardId: true,
      startTime: true,
      endTime: true
    }
  });

  let assignedInCurrentRound = 0;
  let roundOffset = 0; // Used to rotate guard selection each round

  for (const shift of unassignedShifts) {
    // Find guards who are NOT already assigned to an overlapping shift
    // P0-2: Fixed boundary detection to use inclusive comparisons
    // Filter in-memory instead of database query for each shift
    const busyGuardIds = allAssignedShifts
      .filter(s => {
        // Check if shifts overlap (inclusive boundaries)
        const startsOverlap = s.startTime >= shift.startTime && s.startTime <= shift.endTime;
        const endsOverlap = s.endTime >= shift.startTime && s.endTime <= shift.endTime;
        const contains = s.startTime <= shift.startTime && s.endTime >= shift.endTime;
        return startsOverlap || endsOverlap || contains;
      })
      .map(s => s.guardId)
      .filter((id): id is string => id !== null);

    const guardId = await getNextAvailableGuard(periodId, busyGuardIds);

    if (!guardId) {
      console.warn(`No available guard for shift at ${shift.startTime}`);
      continue;
    }

    const shiftDuration = (shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60);

    // Assign guard and update their total hours
    await prisma.$transaction([
      prisma.shift.update({
        where: { id: shift.id },
        data: { guardId }
      }),
      prisma.guard.update({
        where: { id: guardId },
        data: {
          totalHours: {
            increment: shiftDuration
          }
        }
      })
    ]);

    // Update in-memory cache for overlap detection
    allAssignedShifts.push({
      guardId,
      startTime: shift.startTime,
      endTime: shift.endTime
    });

    // Track rounds: when all guards have been assigned once, start new round with rotation
    assignedInCurrentRound++;
    if (assignedInCurrentRound >= allGuards.length) {
      assignedInCurrentRound = 0;
      roundOffset++; // This will cause getNextAvailableGuard to pick differently next round
    }
  }
}

/**
 * Generates morning readiness shifts at 05:30-11:00 each day
 * Preferably assigns guards who were on duty around that time
 */
export async function generateMorningReadinessShifts(periodId: string): Promise<void> {
  const period = await prisma.guardPeriod.findUnique({
    where: { id: periodId }
  });

  if (!period) return;

  let currentDate = new Date(period.startDate);
  const endDate = new Date(period.endDate);
  let previousDayGuards: string[] = []; // Track guards from previous day

  while (currentDate <= endDate) {
    // Get UTC date parts to avoid timezone confusion
    const year = currentDate.getUTCFullYear();
    const month = currentDate.getUTCMonth();
    const day = currentDate.getUTCDate();

    // Create UTC date and then adjust for Israel timezone
    // Israel is UTC+3 (daylight time) - standard approach for most of the year
    // When we want 05:30 in Israel, we need 02:30 UTC (05:30 - 3 = 02:30)
    const morningStartTime = new Date(Date.UTC(year, month, day, 2, 30, 0, 0)); // 05:30 Israel time (UTC+3)
    const morningEndTime = new Date(Date.UTC(year, month, day, 8, 0, 0, 0));   // 11:00 Israel time (UTC+3)

    console.log('Generating morning readiness:', {
      startTime: morningStartTime.toISOString(),
      endTime: morningEndTime.toISOString(),
      israelStart: morningStartTime.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
      israelEnd: morningEndTime.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })
    });

    // P1-4: Exclude guards whose shift STARTS OR ENDS within 4 hours before morning readiness
    // This prevents cases like: shift 01:00-03:00, then morning readiness 05:30-11:00
    const minimumSleepTime = new Date(morningStartTime.getTime() - (4 * 60 * 60 * 1000)); // 4 hours before (01:30)
    const guardsToExclude = await prisma.shift.findMany({
      where: {
        periodId,
        OR: [
          { endTime: { gte: minimumSleepTime, lte: morningStartTime } },
          { startTime: { gte: minimumSleepTime, lte: morningStartTime } }
        ]
      },
      select: { guardId: true },
      distinct: ['guardId']
    });

    const excludedGuardIds = guardsToExclude
      .map(s => s.guardId)
      .filter((id): id is string => id !== null);

    // We need 9 guards for morning readiness
    const selectedGuardIds: string[] = [];

    // Fill slots with guards with lowest total hours
    // Exclude: guards from yesterday (no consecutive days), guards with recent shifts (need sleep)
    // P0-3: Fixed to prevent exceeding 9 guards
    while (selectedGuardIds.length < 9) {
      const excludeIds = [...selectedGuardIds, ...previousDayGuards, ...excludedGuardIds];
      const guardId = await getNextAvailableGuard(periodId, excludeIds);

      if (guardId) {
        selectedGuardIds.push(guardId);
      } else {
        // If we can't find enough guards, relax only the consecutive day constraint
        const excludeIdsRelaxed = [...selectedGuardIds, ...excludedGuardIds];
        const guardIdWithRepeat = await getNextAvailableGuard(periodId, excludeIdsRelaxed);

        if (guardIdWithRepeat) {
          selectedGuardIds.push(guardIdWithRepeat);
        } else {
          // Last resort: just exclude selected guards and those with recent shifts (maintain sleep time)
          const guardIdLastResort = await getNextAvailableGuard(periodId, [...selectedGuardIds, ...excludedGuardIds]);

          if (guardIdLastResort) {
            selectedGuardIds.push(guardIdLastResort);
          } else {
            // Can't find any more guards, stop trying
            break;
          }
        }
      }

      // Safety check to prevent exceeding 9 guards
      if (selectedGuardIds.length >= 9) break;
    }

    // Store today's guards for next iteration
    previousDayGuards = [...selectedGuardIds];

    // Create morning readiness shift (does NOT count toward totalHours)
    for (const guardId of selectedGuardIds) {
      await prisma.shift.create({
        data: {
          startTime: morningStartTime,
          endTime: morningEndTime,
          postType: 'MorningReadiness',
          shiftType: 'day',
          isSpecial: true,
          specialType: 'morning_readiness',
          peopleCount: 9,
          periodId,
          guardId
        }
      });

      // Morning readiness does NOT count toward totalHours - it's just presence duty
    }

    // Move to next day
    currentDate = addHours(currentDate, 24);
  }
}

/**
 * Adds a new guard to a period mid-rotation
 * Sets their hours to the current average to prevent clustering
 * Rebalances future shifts to gradually integrate them
 */
export async function addGuardToPeriod(
  periodId: string,
  name: string,
  rank?: string
): Promise<string> {
  const now = new Date();

  // Calculate average hours of existing guards
  const existingGuards = await prisma.guard.findMany({
    where: { periodId, isActive: true }
  });

  const averageHours = existingGuards.length > 0
    ? existingGuards.reduce((sum, g) => sum + g.totalHours, 0) / existingGuards.length
    : 0;

  // Create the new guard with average hours (fair starting point)
  const guard = await prisma.guard.create({
    data: {
      name,
      rank: rank || '',
      totalHours: averageHours,
      periodId,
      joinedAt: now
    }
  });

  // Rebalance future shifts (shifts after now)
  await rebalanceFutureShifts(periodId, now);

  // Regenerate future morning readiness shifts to include new guard
  await regenerateMorningReadiness(periodId, now);

  return guard.id;
}

/**
 * Removes a guard from active duty
 * Cancels their future shifts and redistributes them
 */
export async function removeGuardFromPeriod(guardId: string): Promise<void> {
  const now = new Date();

  // Mark guard as inactive
  await prisma.guard.update({
    where: { id: guardId },
    data: { isActive: false }
  });

  const guard = await prisma.guard.findUnique({
    where: { id: guardId },
    include: { shifts: true }
  });

  if (!guard) return;

  // Get future shifts (including both regular and special shifts)
  const futureShifts = guard.shifts.filter(shift => new Date(shift.startTime) > now);

  // Separate regular and special shifts
  const regularShifts = futureShifts.filter(s => !s.isSpecial);
  const specialShifts = futureShifts.filter(s => s.isSpecial);

  // Unassign future regular shifts and decrement hours
  for (const shift of regularShifts) {
    const shiftDuration = (shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60);

    await prisma.$transaction([
      prisma.shift.update({
        where: { id: shift.id },
        data: { guardId: null }
      }),
      prisma.guard.update({
        where: { id: guardId },
        data: {
          totalHours: { decrement: shiftDuration }
        }
      })
    ]);
  }

  // Unassign special shifts (morning readiness) - don't decrement hours
  for (const shift of specialShifts) {
    await prisma.shift.update({
      where: { id: shift.id },
      data: { guardId: null }
    });
  }

  // Reassign regular shifts
  await assignGuardsToShifts(guard.periodId, now);

  // Regenerate future morning readiness shifts without the removed guard
  await regenerateMorningReadiness(guard.periodId, now);
}

/**
 * Rebalances future shifts to even out total_hours among active guards
 */
async function rebalanceFutureShifts(periodId: string, fromTime: Date): Promise<void> {
  // Get all future shifts
  const futureShifts = await prisma.shift.findMany({
    where: {
      periodId,
      startTime: { gte: fromTime },
      isSpecial: false
    },
    orderBy: { startTime: 'asc' }
  });

  // Unassign all future shifts and reset hours
  for (const shift of futureShifts) {
    if (shift.guardId) {
      const shiftDuration = (shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60);

      await prisma.$transaction([
        prisma.shift.update({
          where: { id: shift.id },
          data: { guardId: null }
        }),
        prisma.guard.update({
          where: { id: shift.guardId },
          data: {
            totalHours: { decrement: shiftDuration }
          }
        })
      ]);
    }
  }

  // Reassign all future shifts
  await assignGuardsToShifts(periodId, fromTime);
}

/**
 * Regenerates shifts from a specific time forward
 * Used when activity stops to restore normal schedule
 */
export async function regenerateShiftsFromTime(
  periodId: string,
  fromTime: Date
): Promise<void> {
  const period = await prisma.guardPeriod.findUnique({
    where: { id: periodId },
    include: { activities: true }
  });

  if (!period) throw new Error('Period not found');

  // First, delete all existing future shifts (both assigned and unassigned)
  const futureShifts = await prisma.shift.findMany({
    where: {
      periodId,
      startTime: { gte: fromTime },
      isSpecial: false
    }
  });

  // Reset guard hours for deleted shifts
  for (const shift of futureShifts) {
    if (shift.guardId) {
      const shiftDuration = (shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60);
      await prisma.guard.update({
        where: { id: shift.guardId },
        data: {
          totalHours: { decrement: shiftDuration }
        }
      });
    }
  }

  // Delete all future shifts
  await prisma.shift.deleteMany({
    where: {
      periodId,
      startTime: { gte: fromTime },
      isSpecial: false
    }
  });

  interface ShiftInput {
    startTime: Date;
    endTime: Date;
    postType: string;
    shiftType: 'day' | 'night';
    peopleCount: number;
    periodId: string;
  }

  const shifts: ShiftInput[] = [];
  let currentTime = new Date(fromTime);
  const endTime = new Date(period.endDate);
  const shiftLengthHours = period.shiftLength;

  while (currentTime < endTime) {
    const hour = currentTime.getHours();

    // Check if we're in an activity session (skip normal shift generation)
    const isInActivity = period.activities.some(activity =>
      activity.endTime && new Date(activity.startTime) <= currentTime && currentTime < new Date(activity.endTime)
    );

    if (isInActivity) {
      // Skip to next shift length
      currentTime = addHours(currentTime, shiftLengthHours);
      continue;
    }

    // Determine if we're in day or night shift
    const config = (hour >= 8 && hour < 19) ? DAY_SHIFT_CONFIG : NIGHT_SHIFT_CONFIG;

    // Generate shifts for each post
    for (const post of config.posts) {
      for (let i = 0; i < config.peoplePerPost; i++) {
        const shiftEnd = addHours(currentTime, shiftLengthHours);

        shifts.push({
          startTime: new Date(currentTime),
          endTime: shiftEnd,
          postType: post,
          shiftType: config.shiftType,
          peopleCount: config.peoplePerPost,
          periodId
        });
      }
    }

    currentTime = addHours(currentTime, shiftLengthHours);
  }

  // Create shifts in database (without guard assignments yet)
  if (shifts.length > 0) {
    await prisma.shift.createMany({
      data: shifts
    });
  }

  // Now assign guards to all shifts
  await assignGuardsToShifts(periodId, fromTime);
}

/**
 * Regenerates morning readiness shifts from a specific time forward
 * Used when guards are added/removed to rebalance morning readiness assignments
 */
async function regenerateMorningReadiness(periodId: string, fromTime: Date): Promise<void> {
  const period = await prisma.guardPeriod.findUnique({
    where: { id: periodId }
  });

  if (!period) return;

  // Delete all future morning readiness shifts
  await prisma.shift.deleteMany({
    where: {
      periodId,
      startTime: { gte: fromTime },
      isSpecial: true,
      specialType: 'morning_readiness'
    }
  });

  // Regenerate morning readiness from fromTime until end of period
  let currentDate = new Date(fromTime);
  const endDate = new Date(period.endDate);

  // Get the previous day's morning readiness guards (if any exist before fromTime)
  const previousMorningReadiness = await prisma.shift.findMany({
    where: {
      periodId,
      startTime: { lt: fromTime },
      isSpecial: true,
      specialType: 'morning_readiness'
    },
    orderBy: { startTime: 'desc' },
    take: 9,
    select: { guardId: true }
  });

  let previousDayGuards: string[] = previousMorningReadiness
    .map(s => s.guardId)
    .filter((id): id is string => id !== null);

  // Round to start of day
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate <= endDate) {
    const year = currentDate.getUTCFullYear();
    const month = currentDate.getUTCMonth();
    const day = currentDate.getUTCDate();

    const morningStartTime = new Date(Date.UTC(year, month, day, 2, 30, 0, 0));
    const morningEndTime = new Date(Date.UTC(year, month, day, 8, 0, 0, 0));

    // Skip if this morning readiness is in the past
    if (morningStartTime < fromTime) {
      currentDate = addHours(currentDate, 24);
      continue;
    }

    // Exclude guards with shifts ending/starting within 4 hours before morning readiness
    const minimumSleepTime = new Date(morningStartTime.getTime() - (4 * 60 * 60 * 1000));
    const guardsToExclude = await prisma.shift.findMany({
      where: {
        periodId,
        OR: [
          { endTime: { gte: minimumSleepTime, lte: morningStartTime } },
          { startTime: { gte: minimumSleepTime, lte: morningStartTime } }
        ]
      },
      select: { guardId: true },
      distinct: ['guardId']
    });

    const excludedGuardIds = guardsToExclude
      .map(s => s.guardId)
      .filter((id): id is string => id !== null);

    const selectedGuardIds: string[] = [];

    while (selectedGuardIds.length < 9) {
      const excludeIds = [...selectedGuardIds, ...previousDayGuards, ...excludedGuardIds];
      const guardId = await getNextAvailableGuard(periodId, excludeIds);

      if (guardId) {
        selectedGuardIds.push(guardId);
      } else {
        const excludeIdsRelaxed = [...selectedGuardIds, ...excludedGuardIds];
        const guardIdWithRepeat = await getNextAvailableGuard(periodId, excludeIdsRelaxed);

        if (guardIdWithRepeat) {
          selectedGuardIds.push(guardIdWithRepeat);
        } else {
          const guardIdLastResort = await getNextAvailableGuard(periodId, [...selectedGuardIds, ...excludedGuardIds]);

          if (guardIdLastResort) {
            selectedGuardIds.push(guardIdLastResort);
          } else {
            break;
          }
        }
      }

      if (selectedGuardIds.length >= 9) break;
    }

    previousDayGuards = [...selectedGuardIds];

    // Create morning readiness shifts
    for (const guardId of selectedGuardIds) {
      await prisma.shift.create({
        data: {
          startTime: morningStartTime,
          endTime: morningEndTime,
          postType: 'MorningReadiness',
          shiftType: 'day',
          isSpecial: true,
          specialType: 'morning_readiness',
          peopleCount: 9,
          periodId,
          guardId
        }
      });
    }

    currentDate = addHours(currentDate, 24);
  }
}
