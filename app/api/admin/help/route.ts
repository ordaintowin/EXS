import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/api/lib/prisma';
import { getAuthenticatedAdmin } from '@/app/api/lib/auth';

// GET /api/admin/help — get all tickets
export async function GET(request: NextRequest) {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const tickets = await prisma.helpTicket.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        replies: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ tickets });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}
