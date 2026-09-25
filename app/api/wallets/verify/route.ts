import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage } from 'ethers';
import { verify as verifyBitcoinMessage } from 'bitcoinjs-message';
import { TronWeb } from 'tronweb';
import { WalletChain } from '@prisma/client';
import { getTokenFromRequest, verifyToken } from '@/app/api/lib/jwt';
import { prisma } from '@/app/api/lib/prisma';

async function signatureMatches(
  chain: WalletChain,
  address: string,
  message: string,
  signature: string,
): Promise<boolean> {
  try {
    if (chain === WalletChain.ethereum || chain === WalletChain.bsc || chain === WalletChain.polygon) {
      return verifyMessage(message, signature).toLowerCase() === address.toLowerCase();
    }
    if (chain === WalletChain.tron) {
      const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io' });
      return (await tronWeb.trx.verifyMessageV2(message, signature)) === address;
    }
    if (chain === WalletChain.bitcoin) {
      return verifyBitcoinMessage(message, address, signature);
    }
  } catch {
    return false;
  }
  return false;
}

export async function POST(request: NextRequest) {
  const token = getTokenFromRequest(request);
  const user = token ? verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Sign in to link a wallet.' }, { status: 401 });

  try {
    const body = await request.json();
    if (typeof body.challengeId !== 'string' || typeof body.signature !== 'string' || body.signature.length > 2048) {
      return NextResponse.json({ error: 'A valid wallet signature is required.' }, { status: 400 });
    }

    const challenge = await prisma.walletChallenge.findFirst({
      where: {
        id: body.challengeId,
        userId: user.userId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!challenge) return NextResponse.json({ error: 'This verification request expired or was already used. Try again.' }, { status: 400 });

    const matches = await signatureMatches(
      challenge.chain,
      challenge.address,
      challenge.message,
      body.signature,
    );
    if (!matches) return NextResponse.json({ error: 'The signature did not prove control of that address.' }, { status: 400 });

    const wallet = await prisma.$transaction(async (tx) => {
      const consumed = await tx.walletChallenge.updateMany({
        where: { id: challenge.id, userId: user.userId, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (consumed.count !== 1) throw new Error('CHALLENGE_ALREADY_USED');

      return tx.linkedWallet.create({
        data: { userId: user.userId, chain: challenge.chain, address: challenge.address },
        select: { id: true, chain: true, address: true, verifiedAt: true },
      });
    });

    return NextResponse.json({ wallet }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'CHALLENGE_ALREADY_USED') {
      return NextResponse.json({ error: 'This verification request was already used. Try again.' }, { status: 409 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'This wallet address is already linked to an account.' }, { status: 409 });
    }
    console.error('WALLET VERIFY ERROR:', error);
    return NextResponse.json({ error: 'Could not verify this wallet.' }, { status: 500 });
  }
}