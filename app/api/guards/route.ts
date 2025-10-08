import { NextRequest, NextResponse } from 'next/server';
import { addGuardToPeriod } from '@/lib/scheduler';

// POST /api/guards - Add a new guard to a period
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { periodId, name, rank } = body;

    if (!periodId || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const guardId = await addGuardToPeriod(periodId, name, rank);

    return NextResponse.json({ id: guardId, name, rank }, { status: 201 });
  } catch (error) {
    console.error('Error adding guard:', error);
    return NextResponse.json(
      { error: 'Failed to add guard' },
      { status: 500 }
    );
  }
}
