import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/api/lib/prisma';
import { getAuthenticatedAdmin } from '@/app/api/lib/auth';

export async function GET(request: NextRequest) {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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