import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/app/api/lib/prisma';
import { sendEmail } from '@/app/api/lib/email';
import { emailVerificationEmail } from '@/app/api/lib/email-templates';

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function issueEmailVerification(user: { id: string; name: string; email: string }) {
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const token = randomBytes(32).toString('hex');
  await prisma.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';
  const verificationLink = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const sent = await sendEmail({
    to: user.email,
    subject: 'Verify your Exspend email address',
    html: emailVerificationEmail({ userName: user.name, verificationLink }),
  });

  return { sent };
}

export async function consumeEmailVerificationToken(token: string) {
  const verification = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, isVerified: true } } },
  });

  if (!verification) return { error: 'Invalid or expired verification link.' } as const;
  if (verification.usedAt) return { error: 'This verification link has already been used.' } as const;
  if (verification.expiresAt < new Date()) return { error: 'This verification link has expired.' } as const;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: verification.userId },
      data: { isVerified: true },
    }),
    prisma.emailVerificationToken.update({
      where: { id: verification.id },
      data: { usedAt: new Date() },
    }),
    prisma.emailVerificationToken.deleteMany({
      where: { userId: verification.userId, id: { not: verification.id }, usedAt: null },
    }),
  ]);

  return {
    user: verification.user,
  } as const;
}