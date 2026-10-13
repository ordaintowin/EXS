// PATCH /api/profile — update name and phone
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken, signToken } from '@/app/api/lib/jwt';
import { prisma } from '@/app/api/lib/prisma';

export async function PATCH(request: NextRequest) {
  const token = getTokenFromRequest(request);
  const user = token ? verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { name, phone } = await request.json();

    if (name === undefined && phone === undefined) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const updates: { name?: string; phone?: string } = {};
    if (name !== undefined) {
      const normalizedName = String(name).trim();
      if (!normalizedName) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      updates.name = normalizedName;
    }
    if (phone !== undefined) updates.phone = String(phone).trim();

    const updated = await prisma.user.update({
      where: { id: user.userId },
      data: updates,
    });

    const newToken = signToken({
      userId: updated.id,
      email: updated.email,
      name: updated.name,
      isAdmin: updated.isAdmin,
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        isAdmin: updated.isAdmin,
        isVerified: updated.isVerified,
        createdAt: updated.createdAt,
      },
      token: newToken,
    });
  } catch {
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
