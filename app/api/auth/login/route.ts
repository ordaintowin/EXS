import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/app/api/lib/prisma';
import { signToken } from '@/app/api/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.isBanned) {
      return NextResponse.json({ error: 'banned' }, { status: 403 });
    }

    if (!user.isVerified) {
      return NextResponse.json({ error: 'Please verify your email address before signing in.', emailNotVerified: true }, { status: 403 });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isAdmin,
    });

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, isAdmin: user.isAdmin, isVerified: user.isVerified, createdAt: user.createdAt },
    });
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
