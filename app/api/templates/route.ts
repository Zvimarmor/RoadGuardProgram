import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/templates - Get all guard templates
export async function GET() {
  try {
    const templates = await prisma.guardTemplate.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST /api/templates - Save a new guard template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateName, guards } = body;

    if (!templateName || !guards || !Array.isArray(guards)) {
      return NextResponse.json(
        { error: 'Template name and guards array are required' },
        { status: 400 }
      );
    }

    const template = await prisma.guardTemplate.create({
      data: {
        templateName,
        guards: guards
      }
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    console.error('Error saving template:', error);

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A template with this name already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save template' },
      { status: 500 }
    );
  }
}

// DELETE /api/templates - Delete a guard template
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    await prisma.guardTemplate.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
