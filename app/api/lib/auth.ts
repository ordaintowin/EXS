import { NextRequest } from 'next/server';
import { getTokenFromRequest, verifyToken, type JWTPayload } from '@/app/api/lib/jwt';
import { prisma } from '@/app/api/lib/prisma';

export type AuthenticatedUser = JWTPayload & {
  isAdmin: boolean;
  isBanned: boolean;
  isVerified: boolean;
  kycVerified: boolean;
};

export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const token = getTokenFromRequest(request);
  const payload = token ? verifyToken(token) : null;
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      name: true,
      email: true,
      isAdmin: true,
      isBanned: true,
      isVerified: true,
      kycVerified: true,
    },
  });

  if (!user || user.isBanned || !user.isVerified) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    isBanned: user.isBanned,
    isVerified: user.isVerified,
    kycVerified: user.kycVerified,
  };
}

export async function getAuthenticatedAdmin(request: NextRequest): Promise<AuthenticatedUser | null> {
  const user = await getAuthenticatedUser(request);
  return user?.isAdmin ? user : null;
}