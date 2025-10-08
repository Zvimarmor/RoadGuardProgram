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

  return guard?.id || null;
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

  const shifts: any[] = [];
  let currentTime = new Date(period.startDate);
  const endTime = new Date(period.endDate);
  const shiftLengthHours = period.shiftLength;

  while (currentTime < endTime) {
    const hour = currentTime.getHours();

    // Check if we're in an activity session (skip normal shift generation)
    const isInActivity = period.activities.some(activity =>
      isWithinInterval(currentTime, {
        start: new Date(activity.startTime),
        end: new Date(activity.endTime)
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
 */
export async function assignGuardsToShifts(
  periodId: string,
  startFrom?: Date
): Promise<void> {
  // Get all unassigned shifts (optionally from a specific time forward)
  const whereClause: any = {
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

  for (const shift of unassignedShifts) {
    // Find guards who are NOT already assigned to an overlapping shift
    const busyGuards = await prisma.shift.findMany({
      where: {
        periodId,
        guardId: { not: null },
        OR: [
          {
            // Shift starts during this shift
            startTime: { gte: shift.startTime, lt: shift.endTime }
          },
          {
            // Shift ends during this shift
            endTime: { gt: shift.startTime, lte: shift.endTime }
          },
          {
            // Shift completely contains this shift
            startTime: { lte: shift.startTime },
            endTime: { gte: shift.endTime }
          }
        ]
      },
      select: { guardId: true }
    });

    const busyGuardIds = busyGuards.map(s => s.guardId).filter((id): id is string => id !== null);

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
  }
}

/**
 * Generates morning readiness shifts at 05:30-11:00 each day
 * Preferably assigns guards who were on duty around that time
 */
async function generateMorningReadinessShifts(periodId: string): Promise<void> {
  const period = await prisma.guardPeriod.findUnique({
    where: { id: periodId }
  });

  if (!period) return;

  let currentDate = new Date(period.startDate);
  const endDate = new Date(period.endDate);

  while (currentDate <= endDate) {
    const morningStartTime = setHours(setMinutes(currentDate, 30), 5); // 05:30
    const morningEndTime = setHours(setMinutes(currentDate, 0), 11);   // 11:00

    // Find guards on duty around 05:30 (between 04:00 and 06:00)
    const guardsOnDuty = await prisma.shift.findMany({
      where: {
        periodId,
        startTime: { lte: morningStartTime },
        endTime: { gte: morningStartTime }
      },
      include: { guard: true },
      distinct: ['guardId']
    });

    // We need 9 guards for morning readiness
    const selectedGuardIds: string[] = [];

    // First, add guards who are already on duty
    guardsOnDuty.forEach(shift => {
      if (shift.guardId && selectedGuardIds.length < 9) {
        selectedGuardIds.push(shift.guardId);
      }
    });

    // Fill remaining slots with guards with lowest total hours
    while (selectedGuardIds.length < 9) {
      const guardId = await getNextAvailableGuard(periodId, selectedGuardIds);
      if (!guardId) break;
      selectedGuardIds.push(guardId);
    }

    // Create morning readiness shift (5.5 hours: 05:30-11:00)
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

      // Update guard's total hours (5.5 hours)
      await prisma.guard.update({
        where: { id: guardId },
        data: {
          totalHours: { increment: 5.5 }
        }
      });
    }

    // Move to next day
    currentDate = addHours(currentDate, 24);
  }
}

/**
 * Adds a new guard to a period mid-rotation
 * Rebalances future shifts to gradually increase their hours
 */
export async function addGuardToPeriod(
  periodId: string,
  name: string,
  rank?: string
): Promise<string> {
  const now = new Date();

  // Create the new guard
  const guard = await prisma.guard.create({
    data: {
      name,
      rank,
      totalHours: 0,
      periodId,
      joinedAt: now
    }
  });

  // Rebalance future shifts (shifts after now)
  await rebalanceFutureShifts(periodId, now);

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

  // Get future shifts
  const futureShifts = guard.shifts.filter(shift => new Date(shift.startTime) > now);

  // Unassign future shifts
  for (const shift of futureShifts) {
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

  // Reassign those shifts
  await assignGuardsToShifts(guard.periodId, now);
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
 * Creates an activity session and generates shifts for it
 * Pauses normal schedule during the activity
 */
export async function createActivitySession(
  periodId: string,
  name: string,
  startTime: Date,
  endTime: Date,
  guardIds: string[],
  description?: string
): Promise<string> {
  // Create the activity
  const activity = await prisma.activitySession.create({
    data: {
      name,
      startTime,
      endTime,
      description,
      periodId
    }
  });

  // Delete any normal shifts that overlap with this activity
  await prisma.shift.deleteMany({
    where: {
      periodId,
      startTime: { gte: startTime },
      endTime: { lte: endTime }
    }
  });

  // Generate activity shifts (simplified - assign each guard to the full duration)
  for (const guardId of guardIds) {
    await prisma.activityShift.create({
      data: {
        startTime,
        endTime,
        postType: 'Activity',
        activityId: activity.id,
        guardId
      }
    });
  }

  // Rebalance shifts after the activity
  await rebalanceFutureShifts(periodId, endTime);

  return activity.id;
}
