import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/app/api/lib/jwt';
import { prisma } from '@/app/api/lib/prisma';

export async function POST(request: NextRequest) {
    const token = getTokenFromRequest(request);
    const user = await verifyToken(token);

    if (!user) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const recipientType = user.isAdmin ? 'admin' : 'user';
    const updated = await prisma.notification.updateMany({
        where: {
            userId: user.userId,
            recipientType: recipientType,
            isRead: false,
        },
    });

    return NextResponse.json({ success: true, count: updated.count });
}