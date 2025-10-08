import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { periodId, name, guardIds, description } = body;

    const now = new Date();

    // Create the activity (without endTime, isActive = true by default)
    const activity = await prisma.activitySession.create({
      data: {
        name,
        startTime: now,
        description,
        periodId,
        isActive: true
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
