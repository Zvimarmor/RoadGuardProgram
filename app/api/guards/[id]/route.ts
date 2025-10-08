import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { removeGuardFromPeriod } from '@/lib/scheduler';

// GET /api/guards/[id] - Get guard details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = await prisma.guard.findUnique({
      where: { id },
      include: {
        shifts: {
          orderBy: { startTime: 'asc' }
        },
        activityShifts: {
          include: { activity: true }
        }
      }
    });

    if (!guard) {
      return NextResponse.json(
        { error: 'Guard not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(guard);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch guard' },
      { status: 500 }
    );
  }
}

// PATCH /api/guards/[id] - Update guard (e.g., mark inactive)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { isActive, name, rank } = body;

    // If marking as inactive, use the remove function
    if (isActive === false) {
      await removeGuardFromPeriod(id);
      return NextResponse.json({ success: true });
    }

    // Otherwise just update basic fields
    const guard = await prisma.guard.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(rank && { rank }),
        ...(typeof isActive === 'boolean' && { isActive })
      }
    });

    return NextResponse.json(guard);
  } catch (error) {
    console.error('Error updating guard:', error);
    return NextResponse.json(
      { error: 'Failed to update guard' },
      { status: 500 }
    );
  }
}

// DELETE /api/guards/[id] - Remove guard from period
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await removeGuardFromPeriod(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to remove guard' },
      { status: 500 }
    );
  }
}
