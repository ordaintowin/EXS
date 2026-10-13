// GET /api/kyc — get current user's KYC status
// POST /api/kyc — submit KYC documents
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/app/api/lib/jwt';
import { prisma } from '@/app/api/lib/prisma';

export async function GET(request: NextRequest) {
  const token = getTokenFromRequest(request);
  const user = token ? verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const entry = await prisma.kycEntry.findFirst({
      where: { userId: user.userId },
      orderBy: { submittedAt: 'desc' },
    });
    return NextResponse.json({ kyc: entry });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch KYC' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = getTokenFromRequest(request);
  const user = token ? verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { documentType, documentNumber, frontImage, backImage, selfieImage } = await request.json();

    if (!documentType || !documentNumber || !frontImage || !selfieImage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (
      typeof documentType !== 'string' ||
      typeof documentNumber !== 'string' ||
      typeof frontImage !== 'string' ||
      (backImage !== undefined && backImage !== null && typeof backImage !== 'string') ||
      typeof selfieImage !== 'string' ||
      documentType.length > 40 ||
      documentNumber.trim().length < 3 ||
      documentNumber.length > 120 ||
      frontImage.length > 8_000_000 ||
      (backImage && backImage.length > 8_000_000) ||
      selfieImage.length > 8_000_000
    ) {
      return NextResponse.json({ error: 'Invalid KYC document data or image size.' }, { status: 400 });
    }

    const existingPending = await prisma.kycEntry.findFirst({
      where: { userId: user.userId, status: 'pending' },
      select: { id: true },
    });
    if (existingPending) {
      return NextResponse.json({ error: 'Your KYC submission is already under review.' }, { status: 409 });
    }

    const entry = await prisma.kycEntry.create({
      data: {
        userId: user.userId,
        documentType,
        documentNumber,
        frontImage,
        backImage: backImage || null,
        selfieImage,
      },
    });

    return NextResponse.json({ kyc: entry }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to submit KYC' }, { status: 500 });
  }
}
