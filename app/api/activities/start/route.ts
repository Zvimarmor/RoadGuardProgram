import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { periodId, name, guardIds, description } = body;

    // P2-5: Validate guardIds
    if (!guardIds || guardIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one guard must be selected for the activity' },
        { status: 400 }
      );
    }

    const now = new Date();

    // P0-4: Before deleting shifts, decrement guard hours for assigned shifts
    const futureShifts = await prisma.shift.findMany({
      where: {
        periodId,
        startTime: { gte: now },
        isSpecial: false,
        guardId: { not: null }
      }
    });

    // Decrement hours for each assigned shift that will be deleted
    for (const shift of futureShifts) {
      if (shift.guardId) {
        const duration = (shift.endTime.getTime() - shift.startTime.getTime()) / (1000 * 60 * 60);
        await prisma.guard.update({
          where: { id: shift.guardId },
          data: {
            totalHours: {
              decrement: duration
            }
          }
        });
      }
    }

    // Create the activity (without endTime - null endTime means active)
    const activity = await prisma.activitySession.create({
      data: {
        name,
        startTime: now,
        description,
        periodId
      }
    });

    // Delete any normal shifts that overlap with current time going forward
    await prisma.shift.deleteMany({
      where: {
        periodId,
        startTime: { gte: now },
        isSpecial: false
      }
    });

    // Create activity shifts for the selected guards
    // We'll create ongoing shifts (we'll handle them when activity stops)
    for (const guardId of guardIds) {
      await prisma.activityShift.create({
        data: {
          startTime: now,
          endTime: now, // Placeholder - will be updated when activity stops
          postType: 'Activity',
          activityId: activity.id,
          guardId
        }
      });
    }

    return NextResponse.json({
      activityId: activity.id,
      message: 'Activity started successfully'
    });
  } catch (error) {
    console.error('Error starting activity:', error);
    return NextResponse.json(
      { error: 'Failed to start activity' },
      { status: 500 }
    );
  }
}
