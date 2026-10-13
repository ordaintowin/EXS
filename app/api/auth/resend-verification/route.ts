import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/api/lib/prisma';
import { issueEmailVerification } from '@/app/api/lib/email-verification';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true, isVerified: true },
    });

    if (user && !user.isVerified) await issueEmailVerification(user);

    return NextResponse.json({ message: 'If that account needs verification, a new email has been sent.' });
  } catch (error) {
    console.error('RESEND VERIFICATION ERROR:', error);
    return NextResponse.json({ error: 'Could not process the verification request.' }, { status: 500 });
  }
}