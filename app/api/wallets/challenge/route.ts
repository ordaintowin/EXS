import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isAddress, getAddress } from 'ethers';
import { WalletChain } from '@prisma/client';
import { getTokenFromRequest, verifyToken } from '@/app/api/lib/jwt';
import { prisma } from '@/app/api/lib/prisma';

const CHAINS = new Set<string>(Object.values(WalletChain));
const ASSETS_BY_CHAIN: Record<WalletChain, string[]> = {
  ethereum: ['ETH', 'USDT', 'USDC'],
  bsc: ['BNB', 'USDT', 'USDC'],
  polygon: ['POL', 'USDT', 'USDC'],
  tron: ['USDT'],
  bitcoin: ['BTC'],
};
const PROVIDERS = new Set(['metamask', 'trust', 'binance', 'bybit', 'blockchain', 'tronlink', 'unisat', 'manual']);

function normalizeAddress(chain: WalletChain, value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 128) return null;
  const address = value.trim();
  if (!address) return null;

  if (chain === WalletChain.ethereum || chain === WalletChain.bsc || chain === WalletChain.polygon) {
    if (!isAddress(address)) return null;
    return getAddress(address);
  }
  if (chain === WalletChain.tron) {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) ? address : null;
  }
  if (chain === WalletChain.bitcoin) {
    const legacy = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
    const bech32 = /^bc1[ac-hj-np-z02-9]{11,71}$/.test(address);
    return legacy || bech32 ? address : null;
  }
  return null;
}

export async function POST(request: NextRequest) {
  const token = getTokenFromRequest(request);
  const user = token ? verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Sign in to link a wallet.' }, { status: 401 });

  try {
    const body = await request.json();
    if (typeof body.chain !== 'string' || !CHAINS.has(body.chain)) {
      return NextResponse.json({ error: 'Choose a supported network.' }, { status: 400 });
    }

    const chain = body.chain as WalletChain;
    const asset = typeof body.asset === 'string' ? body.asset.trim().toUpperCase() : '';
    if (!ASSETS_BY_CHAIN[chain]?.includes(asset)) {
      return NextResponse.json({ error: 'Choose a supported asset for this network.' }, { status: 400 });
    }
    const provider = typeof body.provider === 'string' && PROVIDERS.has(body.provider) ? body.provider : 'manual';
    const address = normalizeAddress(chain, body.address);
    if (!address) return NextResponse.json({ error: 'That wallet address is not valid for this network.' }, { status: 400 });

    const account = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { isBanned: true },
    });
    if (!account || account.isBanned) {
      return NextResponse.json({ error: 'This account cannot link wallets.' }, { status: 403 });
    }

    const existingNetworkWallet = await prisma.linkedWallet.findFirst({
      where: { userId: user.userId, chain, asset },
      select: { address: true },
    });
    if (existingNetworkWallet) {
      return NextResponse.json({
        error: `You already have a ${asset} wallet linked on ${chain}. Unlink it before adding another wallet for this asset and network.`,
      }, { status: 409 });
    }

    const tooSoon = await prisma.walletChallenge.findFirst({
      where: {
        userId: user.userId,
        chain,
        asset,
        address,
        createdAt: { gt: new Date(Date.now() - 10_000) },
      },
      select: { id: true },
    });
    if (tooSoon) {
      return NextResponse.json({ error: 'Please wait a few seconds before requesting another verification.' }, { status: 429 });
    }

    const nonce = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    const message = [
      'Exspend wallet ownership check',
      '',
      'Signing proves control of this public address only.',
      'It does not authorize a payment, transfer, or token approval.',
      '',
      `Account: ${user.userId}`,
      `Network: ${chain}`,
      `Asset: ${asset}`,
      `Provider: ${provider}`,
      `Address: ${address}`,
      `One-time code: ${nonce}`,
      `Expires: ${expiresAt.toISOString()}`,
    ].join('\n');

    const challenge = await prisma.walletChallenge.create({
      data: { userId: user.userId, chain, asset, provider, address, message, expiresAt },
      select: { id: true, message: true, expiresAt: true },
    });

    return NextResponse.json({ challenge });
  } catch (error) {
    console.error('WALLET CHALLENGE ERROR:', error);
    return NextResponse.json({ error: 'Could not start wallet verification.' }, { status: 500 });
  }
}