import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/app/api/lib/jwt';
import { prisma } from '@/app/api/lib/prisma';

export async function GET(request: NextRequest) {
  const token = getTokenFromRequest(request);
  const payload = token ? verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { isAdmin: true, isBanned: true },
  });
  if (!admin?.isAdmin || admin.isBanned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const deposits = await prisma.chainDeposit.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        chain: true,
        txHash: true,
        destination: true,
        sourceAddress: true,
        asset: true,
        tokenAddress: true,
        amount: true,
        blockNumber: true,
        status: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ deposits });
  } catch (error) {
    console.error('ADMIN DEPOSITS ERROR:', error);
    return NextResponse.json({ error: 'Could not load incoming transfer history.' }, { status: 500 });
  }
}