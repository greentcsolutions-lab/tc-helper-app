// src/app/api/teams/[teamId]/route.ts
// API routes for individual team operations

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';

/**
 * GET /api/teams/[teamId]
 * Fetch a specific team's details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = await params;

    // Get user from database
    const dbUser = await db.user.findUnique({
      where: { clerkId: user.id },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user is a member of this team
    const team = await db.team.findFirst({
      where: {
        id: teamId,
        members: {
          some: {
            userId: dbUser.id,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            parses: true,
            tasks: true,
            templates: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json({ team });
  } catch (error) {
    console.error('Error fetching team:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/teams/[teamId]
 * Update team details (owner only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = await params;

    // Get user from database
    const dbUser = await db.user.findUnique({
      where: { clerkId: user.id },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user is the owner of this team
    const membership = await db.teamMember.findFirst({
      where: {
        teamId,
        userId: dbUser.id,
        role: 'owner',
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only team owners can update team settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, maxMembers } = body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (maxMembers) updateData.maxMembers = maxMembers;

    const team = await db.team.update({
      where: { id: teamId },
      data: updateData,
      include: {
        members: true,
      },
    });

    return NextResponse.json({ team });
  } catch (error) {
    console.error('Error updating team:', error);
    return NextResponse.json(
      { error: 'Failed to update team' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teams/[teamId]
 * Delete a team (owner only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamId } = await params;

    // Get user from database
    const dbUser = await db.user.findUnique({
      where: { clerkId: user.id },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user is the owner of this team
    const membership = await db.teamMember.findFirst({
      where: {
        teamId,
        userId: dbUser.id,
        role: 'owner',
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'Only team owners can delete the team' },
        { status: 403 }
      );
    }

    await db.team.delete({
      where: { id: teamId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team:', error);
    return NextResponse.json(
      { error: 'Failed to delete team' },
      { status: 500 }
    );
  }
}
