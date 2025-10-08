import { NextRequest, NextResponse } from 'next/server';
import { addGuardToPeriod } from '@/lib/scheduler';

// POST /api/guards/add - Add a guard to a period mid-rotation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { periodId, name, rank } = body;

    if (!periodId || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: periodId and name' },
        { status: 400 }
      );
    }

    const guardId = await addGuardToPeriod(periodId, name, rank);

    return NextResponse.json({ guardId, message: 'Guard added successfully' });
  } catch (error) {
    console.error('Error adding guard:', error);

    // Check if it's a unique constraint error
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A guard with this name already exists in this period' },
        { status: 409 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to add guard', details: errorMessage },
      { status: 500 }
    );
  }
}
