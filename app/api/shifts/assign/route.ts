import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/shifts/assign - Assign or remove a guard from a shift
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shiftId, guardId } = body; // guardId can be null to remove

    if (!shiftId) {
      return NextResponse.json(
        { error: 'Shift ID is required' },
        { status: 400 }
      );
    }

    // Get the shift
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { guard: true }
    });

    if (!shift) {
      return NextResponse.json(
        { error: 'Shift not found' },
        { status: 404 }
      );
    }

    const oldGuardId = shift.guardId;
    const shiftDuration = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);

    // Update shift and guard hours
    await prisma.$transaction(async (tx) => {
      // Update the shift assignment
      await tx.shift.update({
        where: { id: shiftId },
        data: { guardId: guardId || null }
      });

      // Update old guard hours (decrement if guard was removed)
      if (oldGuardId) {
        await tx.guard.update({
          where: { id: oldGuardId },
          data: {
            totalHours: {
              decrement: shiftDuration
            }
          }
        });
      }

      // Update new guard hours (increment if guard was assigned)
      if (guardId) {
        await tx.guard.update({
          where: { id: guardId },
          data: {
            totalHours: {
              increment: shiftDuration
            }
          }
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: guardId ? 'Guard assigned successfully' : 'Guard removed successfully'
    });
  } catch (error) {
    console.error('Error assigning/removing guard:', error);
    return NextResponse.json(
      { error: 'Failed to update shift assignment' },
      { status: 500 }
    );
  }
}
