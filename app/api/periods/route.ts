import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateShiftsForPeriod } from '@/lib/scheduler';

// GET /api/periods - List all periods
export async function GET() {
  try {
    const periods = await prisma.guardPeriod.findMany({
      include: {
        guards: true,
        _count: {
          select: { shifts: true, activities: true }
        }
      },
      orderBy: { startDate: 'desc' }
    });

    return NextResponse.json(periods);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch periods' },
      { status: 500 }
    );
  }
}

// POST /api/periods - Create a new period
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, startDate, endDate, shiftLength, guards } = body;

    // Validate required fields
    if (!name || !startDate || !endDate || !shiftLength) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // P0-5: Validate dates and shift length
    const start = new Date(startDate);
    const end = new Date(endDate);
    const shiftLen = parseFloat(shiftLength);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (end <= start) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    if (shiftLen <= 0 || shiftLen > 24) {
      return NextResponse.json(
        { error: 'Shift length must be between 0 and 24 hours' },
        { status: 400 }
      );
    }

    // Process guards and validate count
    interface GuardInput {
      name: string;
      team?: string;
    }

    let uniqueGuards: GuardInput[] = [];

    if (guards && Array.isArray(guards)) {
      console.log('Received guards:', JSON.stringify(guards, null, 2));

      uniqueGuards = (guards as GuardInput[]).filter((guard: GuardInput, index: number, self: GuardInput[]) =>
        guard.name && guard.name.trim() &&
        index === self.findIndex((g: GuardInput) => g.name.trim() === guard.name.trim())
      );

      console.log('Unique guards after filtering:', JSON.stringify(uniqueGuards, null, 2));
    }

    // P1-3: Validate minimum guard count (need 4 for night shifts: 2 posts × 2 guards)
    if (uniqueGuards.length < 4) {
      return NextResponse.json(
        { error: 'Minimum 4 guards required (night shifts need 4 simultaneous guards)' },
        { status: 400 }
      );
    }

    // P0-1: Use transaction to prevent race condition for period creation
    // Note: Shift generation happens AFTER transaction to avoid complexity
    const period = await prisma.$transaction(async (tx) => {
      // Check if any active periods exist
      const existingPeriods = await tx.guardPeriod.findMany({});

      // Delete existing periods only after checking (prevents race condition)
      if (existingPeriods.length > 0) {
        await tx.guardPeriod.deleteMany({});
      }

      // Create period
      const newPeriod = await tx.guardPeriod.create({
        data: {
          name,
          startDate: start,
          endDate: end,
          shiftLength: shiftLen
        }
      });

      // Add guards
      if (uniqueGuards.length > 0) {
        const guardsToCreate = uniqueGuards.map((guard: GuardInput) => ({
          name: guard.name.trim(),
          team: guard.team?.trim() || '',
          periodId: newPeriod.id,
          totalHours: 0
        }));

        console.log('Creating guards:', JSON.stringify(guardsToCreate, null, 2));

        await tx.guard.createMany({
          data: guardsToCreate
        });

        console.log(`Successfully created ${guardsToCreate.length} guards`);
      }

      return newPeriod;
    }, {
      timeout: 30000, // 30 seconds for period+guards creation
      maxWait: 10000  // Max 10 seconds wait to acquire transaction
    });

    // Generate shifts AFTER transaction (uses separate queries)
    // If this fails, period exists but has no shifts (acceptable - admin can retry)
    await generateShiftsForPeriod(period.id);

    // Fetch the complete period with all relations
    const completePeriod = await prisma.guardPeriod.findUnique({
      where: { id: period.id },
      include: {
        guards: true,
        shifts: {
          include: { guard: true },
          orderBy: { startTime: 'asc' }
        }
      }
    });

    return NextResponse.json(completePeriod, { status: 201 });
  } catch (error) {
    console.error('Error creating period:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('Error details:', { message: errorMessage, stack: errorStack });
    return NextResponse.json(
      { error: 'Failed to create period', details: errorMessage },
      { status: 500 }
    );
  }
}
