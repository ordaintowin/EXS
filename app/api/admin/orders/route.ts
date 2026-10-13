import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/api/lib/prisma';
import { getAuthenticatedAdmin } from '@/app/api/lib/auth';

// GET /api/admin/orders — get ALL orders with user info
export async function GET(request: NextRequest) {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { name: true, email: true, phone: true },
        },
        receipt: true,
      },
    });
    return NextResponse.json({ orders });
  } catch (err) {
    console.error('ADMIN ORDERS ERROR:', err);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}