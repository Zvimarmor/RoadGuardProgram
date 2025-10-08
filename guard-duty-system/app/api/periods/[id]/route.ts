import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/periods/[id] - Get a specific period
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const period = await prisma.guardPeriod.findUnique({
      where: { id },
      include: {
        guards: {
          orderBy: { totalHours: 'asc' }
        },
        shifts: {
          include: { guard: true },
          orderBy: { startTime: 'asc' }
        },
        activities: {
          include: {
            activityShifts: {
              include: { guard: true }
            }
          }
        }
      }
    });

    if (!period) {
      return NextResponse.json(
        { error: 'Period not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(period);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch period' },
      { status: 500 }
    );
  }
}

// DELETE /api/periods/[id] - Delete a period
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.guardPeriod.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete period' },
      { status: 500 }
    );
  }
}
