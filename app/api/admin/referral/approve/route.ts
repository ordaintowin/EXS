import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/api/lib/prisma';
import { getAuthenticatedAdmin } from '@/app/api/lib/auth';

// POST /api/admin/referral/approve — admin approves a referral reward
export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { rewardId } = await request.json();

    if (!rewardId) {
      return NextResponse.json({ error: 'rewardId is required' }, { status: 400 });
    }

    const reward = await prisma.referralReward.findUnique({
      where: { id: rewardId },
      include: {
        referrer: { select: { kycVerified: true } },
        referredUser: { select: { kycVerified: true } },
      },
    });
    if (!reward) {
      return NextResponse.json({ error: 'Reward not found' }, { status: 404 });
    }
    if (reward.status !== 'pending') {
      return NextResponse.json({ error: 'Reward is not in pending state' }, { status: 400 });
    }
    if (!reward.referrer.kycVerified) {
      return NextResponse.json({ error: 'Referrer is not KYC verified' }, { status: 400 });
    }
    if (!reward.referredUser.kycVerified) {
      return NextResponse.json({ error: 'Referred user is not KYC verified' }, { status: 400 });
    }

    const updated = await prisma.referralReward.update({
      where: { id: rewardId },
      data: {
        status: 'approved',
        approvedBy: admin.userId,
        approvedAt: new Date(),
      },
    });

    // Update referrer's points
    await prisma.user.update({
      where: { id: reward.referrerId },
      data: { referralPoints: { increment: 1 } },
    });

    return NextResponse.json({ reward: updated });
  } catch (err) {
    console.error('REFERRAL APPROVE ERROR:', err);
    return NextResponse.json({ error: 'Failed to approve reward' }, { status: 500 });
  }
}
