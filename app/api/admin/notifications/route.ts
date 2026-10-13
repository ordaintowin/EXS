import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/api/lib/prisma';
import { getAuthenticatedAdmin } from '@/app/api/lib/auth';

// POST /api/admin/notifications — create a notification for a specific user
export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { userId, title, message, link } = body as {
      userId?: string;
      title?: string;
      message?: string;
      link?: string;
    };

    if (!userId || !title || !message) {
      return NextResponse.json({ error: 'Missing required fields: userId, title, message' }, { status: 400 });
    }

    const notification = await prisma.notification.create({
      data: { userId, recipientType: 'user', title, message, link: link ?? null },
    });
    return NextResponse.json({ notification }, { status: 201 });
  } catch (err) {
    console.error('ADMIN NOTIFICATION CREATE ERROR:', err);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}
