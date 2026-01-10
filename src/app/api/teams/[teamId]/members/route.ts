// src/app/api/teams/[teamId]/members/route.ts
// API routes for team member management

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/prisma';

/**
 * GET /api/teams/[teamId]/members
 * Fetch all members of a team
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
    const membership = await db.teamMember.findFirst({
      where: {
        teamId,
        userId: dbUser.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this team' },
        { status: 403 }
      );
    }

    // Get all team members
    const members = await db.teamMember.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            assignedTasks: true,
          },
        },
      },
      orderBy: [
        { role: 'desc' }, // owner first
        { joinedAt: 'asc' },
      ],
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teams/[teamId]/members
 * Add a new member to the team (owner only)
 */
export async function POST(
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
        { error: 'Only team owners can add members' },
        { status: 403 }
      );
    }

    // Check team capacity
    const team = await db.team.findUnique({
      where: { id: teamId },
      select: {
        maxMembers: true,
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    if (team._count.members >= team.maxMembers) {
      return NextResponse.json(
        { error: 'Team has reached maximum member capacity' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { userId, clerkUserId, email, name, role = 'member' } = body;

    if (!userId || !clerkUserId || !email) {
      return NextResponse.json(
        { error: 'User ID, Clerk User ID, and email are required' },
        { status: 400 }
      );
    }

    // Check if user is already a member
    const existingMember = await db.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this team' },
        { status: 400 }
      );
    }

    // Add member
    const newMember = await db.teamMember.create({
      data: {
        teamId,
        userId,
        clerkUserId,
        role,
        email,
        name,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ member: newMember }, { status: 201 });
  } catch (error) {
    console.error('Error adding team member:', error);
    return NextResponse.json(
      { error: 'Failed to add team member' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teams/[teamId]/members/[memberId]
 * Remove a member from the team (owner only, or self-removal)
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
    const searchParams = request.nextUrl.searchParams;
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      );
    }

    // Get user from database
    const dbUser = await db.user.findUnique({
      where: { clerkId: user.id },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get member to be removed
    const memberToRemove = await db.teamMember.findUnique({
      where: { id: memberId },
    });

    if (!memberToRemove || memberToRemove.teamId !== teamId) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Check if user is owner or removing themselves
    const currentMembership = await db.teamMember.findFirst({
      where: {
        teamId,
        userId: dbUser.id,
      },
    });

    const isSelfRemoval = memberToRemove.userId === dbUser.id;
    const isOwner = currentMembership?.role === 'owner';

    if (!isSelfRemoval && !isOwner) {
      return NextResponse.json(
        { error: 'Only team owners can remove members' },
        { status: 403 }
      );
    }

    // Prevent owner from removing themselves if they're the only owner
    if (isSelfRemoval && memberToRemove.role === 'owner') {
      const ownerCount = await db.teamMember.count({
        where: {
          teamId,
          role: 'owner',
        },
      });

      if (ownerCount === 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last owner. Transfer ownership first.' },
          { status: 400 }
        );
      }
    }

    // Remove member
    await db.teamMember.delete({
      where: { id: memberId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing team member:', error);
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    );
  }
}
