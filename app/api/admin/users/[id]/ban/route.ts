// POST /api/admin/users/[id]/ban — admin only, toggle ban status for a user
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/app/api/lib/jwt';
import { prisma } from '@/app/api/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = getTokenFromRequest(request);
  const admin = token ? verifyToken(token) : null;
  if (!admin || !admin.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const { banned } = body as { banned?: boolean };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Prevent banning other admins
    if (user.isAdmin) {
      return NextResponse.json({ error: 'Cannot ban an admin user' }, { status: 400 });
    }

    const newBannedState = typeof banned === 'boolean' ? banned : !user.isBanned;

    const updated = await prisma.user.update({
      where: { id },
      data: { isBanned: newBannedState },
      select: { id: true, name: true, email: true, isBanned: true },
    });

    return NextResponse.json({ user: updated });
  } catch {
    return NextResponse.json({ error: 'Failed to update ban status' }, { status: 500 });
  }
}
