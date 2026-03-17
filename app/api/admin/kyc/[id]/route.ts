// PATCH /api/admin/kyc/[id] — approve or reject a KYC submission (admin only)
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/app/api/lib/jwt';
import { prisma } from '@/app/api/lib/prisma';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = getTokenFromRequest(request);
  const user = token ? verifyToken(token) : null;
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { action, rejectionReason } = await request.json();

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { id } = await params;

    // Fetch entry first for userId (also lets us 404 if missing)
    const existing = await prisma.kycEntry.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'KYC entry not found' }, { status: 404 });
    }

    const isApprove = action === 'approve';

    const updated = await prisma.$transaction(async (tx) => {
      const updatedEntry = await tx.kycEntry.update({
        where: { id },
        data: {
          status: isApprove ? 'approved' : 'rejected',
          reviewedAt: new Date(),
          ...(action === 'reject'
            ? { rejectionReason: rejectionReason ?? null }
            : { rejectionReason: null }),
        },
      });

      // Keep User.kycVerified in sync (source of truth for quota)
      const updatedUser = await tx.user.update({
        where: { id: existing.userId },
        data: { kycVerified: isApprove },
        select: { referredBy: true },
      });

      // Create a ReferralReward if approved user was referred and no reward exists yet
      if (isApprove && updatedUser.referredBy) {
        const existingReward = await tx.referralReward.findFirst({
          where: { referredUserId: existing.userId },
          select: { id: true },
        });

        if (!existingReward) {
          await tx.referralReward.create({
            data: {
              referrerId: updatedUser.referredBy,
              referredUserId: existing.userId,
              rewardType: 'airtime', // default reward type
              rewardNetwork: 'mtn', // default network
              status: 'pending',
            },
          });
        }
      }

      return updatedEntry;
    });

    return NextResponse.json({ kyc: updated });
  } catch (err) {
    console.error('ADMIN KYC UPDATE ERROR:', err);
    return NextResponse.json({ error: 'Failed to update KYC' }, { status: 500 });
  }
}