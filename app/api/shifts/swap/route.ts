import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/shifts/swap - Swap guards between two shifts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shift1Id, shift2Id } = body;

    if (!shift1Id || !shift2Id) {
      return NextResponse.json(
        { error: 'Both shift IDs are required' },
        { status: 400 }
      );
    }

    // Get both shifts
    const [shift1, shift2] = await Promise.all([
      prisma.shift.findUnique({
        where: { id: shift1Id },
        include: { guard: true }
      }),
      prisma.shift.findUnique({
        where: { id: shift2Id },
        include: { guard: true }
      })
    ]);

    if (!shift1 || !shift2) {
      return NextResponse.json(
        { error: 'One or both shifts not found' },
        { status: 404 }
      );
    }

    const guard1Id = shift1.guardId;
    const guard2Id = shift2.guardId;

    // Calculate durations for hour tracking
    const shift1Duration = (new Date(shift1.endTime).getTime() - new Date(shift1.startTime).getTime()) / (1000 * 60 * 60);
    const shift2Duration = (new Date(shift2.endTime).getTime() - new Date(shift2.startTime).getTime()) / (1000 * 60 * 60);

    // Swap the guards and update their hours accordingly
    await prisma.$transaction(async (tx) => {
      // Update shift assignments
      await tx.shift.update({
        where: { id: shift1Id },
        data: { guardId: guard2Id }
      });

      await tx.shift.update({
        where: { id: shift2Id },
        data: { guardId: guard1Id }
      });

      // Update guard hours if guards are swapping between different duration shifts
      if (guard1Id && guard2Id && shift1Duration !== shift2Duration) {
        // Guard1: loses shift1Duration, gains shift2Duration
        await tx.guard.update({
          where: { id: guard1Id },
          data: {
            totalHours: {
              increment: shift2Duration - shift1Duration
            }
          }
        });

        // Guard2: loses shift2Duration, gains shift1Duration
        await tx.guard.update({
          where: { id: guard2Id },
          data: {
            totalHours: {
              increment: shift1Duration - shift2Duration
            }
          }
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Guards swapped successfully'
    });
  } catch (error) {
    console.error('Error swapping guards:', error);
    return NextResponse.json(
      { error: 'Failed to swap guards' },
      { status: 500 }
    );
  }
}
