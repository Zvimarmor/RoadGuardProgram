import { NextRequest, NextResponse } from 'next/server';
import { removeGuardFromPeriod } from '@/lib/scheduler';

// POST /api/guards/remove - Remove a guard from active duty
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { guardId } = body;

    if (!guardId) {
      return NextResponse.json(
        { error: 'Missing required field: guardId' },
        { status: 400 }
      );
    }

    await removeGuardFromPeriod(guardId);

    return NextResponse.json({ message: 'Guard removed successfully' });
  } catch (error) {
    console.error('Error removing guard:', error);
    return NextResponse.json(
      { error: 'Failed to remove guard' },
      { status: 500 }
    );
  }
}
