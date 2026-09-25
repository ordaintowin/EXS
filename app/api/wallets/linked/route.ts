import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/app/api/lib/jwt';
import { prisma } from '@/app/api/lib/prisma';

function authenticatedUser(request: NextRequest) {
  const token = getTokenFromRequest(request);
  return token ? verifyToken(token) : null;
}

export async function GET(request: NextRequest) {
  const user = authenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const wallets = await prisma.linkedWallet.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, chain: true, address: true, verifiedAt: true, createdAt: true },
    });
    return NextResponse.json({ wallets });
  } catch (error) {
    console.error('LINKED WALLETS GET ERROR:', error);
    return NextResponse.json({ error: 'Could not load linked wallets.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = authenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Wallet id is required.' }, { status: 400 });

  try {
    const deleted = await prisma.linkedWallet.deleteMany({ where: { id, userId: user.userId } });
    if (deleted.count === 0) return NextResponse.json({ error: 'Wallet not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('LINKED WALLET DELETE ERROR:', error);
    return NextResponse.json({ error: 'Could not unlink wallet.' }, { status: 500 });
  }
}