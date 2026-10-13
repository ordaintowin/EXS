import { NextRequest, NextResponse } from 'next/server';
import { consumeEmailVerificationToken } from '@/app/api/lib/email-verification';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    if (typeof token !== 'string' || token.length < 32) {
      return NextResponse.json({ error: 'A valid verification token is required.' }, { status: 400 });
    }

    const result = await consumeEmailVerificationToken(token);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });

    return NextResponse.json({ message: 'Email verified successfully.' });
  } catch (error) {
    console.error('EMAIL VERIFICATION ERROR:', error);
    return NextResponse.json({ error: 'Could not verify your email address.' }, { status: 500 });
  }
}