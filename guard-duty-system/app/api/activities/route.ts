import { NextRequest, NextResponse } from 'next/server';
import { createActivitySession } from '@/lib/scheduler';

// POST /api/activities - Create a new activity session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { periodId, name, startTime, endTime, guardIds, description } = body;

    if (!periodId || !name || !startTime || !endTime || !guardIds) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const activityId = await createActivitySession(
      periodId,
      name,
      new Date(startTime),
      new Date(endTime),
      guardIds,
      description
    );

    return NextResponse.json({ id: activityId }, { status: 201 });
  } catch (error) {
    console.error('Error creating activity:', error);
    return NextResponse.json(
      { error: 'Failed to create activity session' },
      { status: 500 }
    );
  }
}
