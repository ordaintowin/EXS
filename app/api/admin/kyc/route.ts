// GET /api/admin/kyc — list all KYC submissions (admin only)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/api/lib/prisma';
import { getAuthenticatedAdmin } from '@/app/api/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedAdmin(request);
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const kyc = await prisma.kycEntry.findMany({
      orderBy: { submittedAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    const enriched = kyc.map((entry: typeof kyc[number]) => ({
      id: entry.id,
      userId: entry.userId,
      documentType: entry.documentType,
      documentNumber: entry.documentNumber,
      frontImage: entry.frontImage,
      backImage: entry.backImage,
      selfieImage: entry.selfieImage,
      status: entry.status,
      rejectionReason: entry.rejectionReason,
      submittedAt: entry.submittedAt,
      reviewedAt: entry.reviewedAt,
      userName: entry.user.name,
      userEmail: entry.user.email,
    }));

    return NextResponse.json({ kyc: enriched });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch KYC submissions' }, { status: 500 });
  }
}
