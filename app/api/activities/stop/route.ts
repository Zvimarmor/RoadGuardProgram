import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { regenerateShiftsFromTime } from '@/lib/scheduler';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { activityId } = body;

    const now = new Date();

    // Get the activity
    const activity = await prisma.activitySession.findUnique({
      where: { id: activityId },
      include: { activityShifts: true }
    });

    if (!activity) {
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      );
    }

    // Update activity with endTime
    await prisma.activitySession.update({
      where: { id: activityId },
      data: {
        endTime: now
      }
    });

    // Update all activity shifts with the actual end time
    await prisma.activityShift.updateMany({
      where: { activityId },
      data: { endTime: now }
    });

    // Regenerate normal shifts from now until end of period
    await regenerateShiftsFromTime(activity.periodId, now);

    return NextResponse.json({
      message: 'Activity stopped successfully, normal schedule resumed'
    });
  } catch (error) {
    console.error('Error stopping activity:', error);
    return NextResponse.json(
      { error: 'Failed to stop activity' },
      { status: 500 }
    );
  }
}
