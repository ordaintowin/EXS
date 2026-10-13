import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/app/api/lib/prisma';
import { generateUniqueReferralCode } from '@/app/api/lib/referral';
import { issueEmailVerification } from '@/app/api/lib/email-verification';

export async function POST(request: NextRequest) {
  try {
    const { name, email, phone, password, referralCode } = await request.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';

    if (!normalizedName || !normalizedEmail || !normalizedPhone || !password) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    // Validate referral code if provided
    let referrerId: string | null = null;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({
        where: { referralCode: referralCode.trim().toUpperCase() },
        select: { id: true, email: true },
      });
      if (!referrer) {
        return NextResponse.json({ error: 'Invalid referral code' }, { status: 400 });
      }
      if (referrer.email === normalizedEmail) {
        return NextResponse.json({ error: 'You cannot use your own referral code' }, { status: 400 });
      }
      referrerId = referrer.id;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Generate a unique referral code for the new user
    const newUserReferralCode = await generateUniqueReferralCode();

    const newUser = await prisma.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash,
        isAdmin: false,
        referralCode: newUserReferralCode,
        referredBy: referrerId,
      },
    });

    const verification = await issueEmailVerification(newUser);

    return NextResponse.json({
      verificationRequired: true,
      verificationSent: verification.sent,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, phone: newUser.phone, isAdmin: newUser.isAdmin, createdAt: newUser.createdAt },
    }, { status: 201 });
  } catch (error) {
    console.error('REGISTRATION ERROR:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
