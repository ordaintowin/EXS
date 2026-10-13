// POST /api/admin/users/[id]/verify — admin only, manually verify a user
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/api/lib/prisma';
import { getAuthenticatedAdmin } from '@/app/api/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const updated = await prisma.user.update({
      where: { id },
      data: { isVerified: true },
      select: { id: true, name: true, email: true, isVerified: true },
    });

    await prisma.emailVerificationToken.deleteMany({
      where: { userId: id, usedAt: null },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('ADMIN VERIFY USER ERROR:', error);
    return NextResponse.json({ error: 'Failed to verify user' }, { status: 500 });
  }
}