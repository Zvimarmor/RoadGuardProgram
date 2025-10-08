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

    // Delete all existing periods (only one period should exist at a time)
    await prisma.guardPeriod.deleteMany({});

    // Create period
    const period = await prisma.guardPeriod.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        shiftLength: parseFloat(shiftLength)
      }
    });

    // Add guards if provided (filter duplicates by name)
    if (guards && Array.isArray(guards)) {
      console.log('Received guards:', JSON.stringify(guards, null, 2));

      interface GuardInput {
        name: string;
      }

      const uniqueGuards = (guards as GuardInput[]).filter((guard: GuardInput, index: number, self: GuardInput[]) =>
        guard.name && guard.name.trim() &&
        index === self.findIndex((g: GuardInput) => g.name.trim() === guard.name.trim())
      );

      console.log('Unique guards after filtering:', JSON.stringify(uniqueGuards, null, 2));

      if (uniqueGuards.length > 0) {
        const guardsToCreate = uniqueGuards.map((guard: GuardInput) => ({
          name: guard.name.trim(),
          periodId: period.id,
          totalHours: 0
        }));

        console.log('Creating guards:', JSON.stringify(guardsToCreate, null, 2));

        await prisma.guard.createMany({
          data: guardsToCreate
        });

        console.log(`Successfully created ${guardsToCreate.length} guards`);
      } else {
        console.log('No unique guards to create');
      }
    } else {
      console.log('No guards array provided or guards is not an array');
    }

    // Generate shifts for the period
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
    return NextResponse.json(
      { error: 'Failed to create period' },
      { status: 500 }
    );
  }
}
