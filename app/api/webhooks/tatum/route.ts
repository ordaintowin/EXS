import { createHmac, timingSafeEqual } from 'node:crypto';
import { formatUnits } from 'ethers';
import { NextRequest, NextResponse } from 'next/server';
import { WalletChain } from '@prisma/client';
import { prisma } from '@/app/api/lib/prisma';

export const dynamic = 'force-dynamic';

function verifyTatumSignature(payload: unknown, received: string | null): boolean {
  const secret = process.env.TATUM_HMAC_SECRET;
  if (!secret || !received) return false;

  const expected = createHmac('sha512', secret)
    .update(JSON.stringify(payload))
    .digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(received, 'base64');
  } catch {
    return false;
  }
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function chainFromEvent(value: unknown): WalletChain | null {
  if (typeof value !== 'string') return null;
  const chain = value.toLowerCase();
  if (chain.includes('ethereum') || chain === 'eth') return WalletChain.ethereum;
  if (chain.includes('bsc') || chain.includes('bnb')) return WalletChain.bsc;
  if (chain.includes('polygon') || chain === 'pol') return WalletChain.polygon;
  if (chain.includes('tron') || chain === 'trx') return WalletChain.tron;
  if (chain.includes('bitcoin') || chain === 'btc') return WalletChain.bitcoin;
  return null;
}

function configuredAddresses(
  chain: WalletChain,
  settings: Record<string, unknown>,
): string[] {
  const fields: Record<WalletChain, string[]> = {
    ethereum: ['ETH'],
    bsc: ['BNB', 'USDT_BEP20', 'USDC_BEP20'],
    polygon: ['USDT_POLYGON', 'USDC_POLYGON'],
    tron: ['USDT_TRC20'],
    bitcoin: ['BTC'],
  };
  return fields[chain]
    .map((key) => settings[key])
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());
}

function amountFromEvent(event: Record<string, unknown>): string | null {
  const value = event.amount ?? event.value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value);
  const decimals = asRecord(event.tokenMetadata)?.decimals;
  if (event.value !== undefined && typeof decimals === 'number' && Number.isInteger(decimals) && decimals >= 0 && decimals <= 36) {
    try {
      return formatUnits(BigInt(raw), decimals);
    } catch {
      return null;
    }
  }
  return raw.slice(0, 100);
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > 64_000) return NextResponse.json({ error: 'Payload is too large.' }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (!verifyTatumSignature(body, request.headers.get('x-payload-hash'))) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  const outer = asRecord(body);
  const event = asRecord(outer?.data) ?? outer;
  if (!event) return NextResponse.json({ error: 'Invalid event.' }, { status: 400 });

  const txHash = event.txId ?? event.txHash;
  const destination = event.to ?? event.address;
  const chain = chainFromEvent(event.chain ?? event.asset);
  const amount = amountFromEvent(event);
  const assetValue = event.currency ?? event.symbol ?? event.asset ?? event.type;
  if (
    typeof txHash !== 'string' ||
    txHash.length < 8 ||
    txHash.length > 200 ||
    typeof destination !== 'string' ||
    destination.length > 128 ||
    !chain ||
    !amount ||
    typeof assetValue !== 'string'
  ) {
    return NextResponse.json({ error: 'Event is missing required transaction details.' }, { status: 400 });
  }

  const settings = await prisma.walletSettings.findUnique({ where: { id: 'singleton' } });
  if (!settings) return NextResponse.json({ received: true, ignored: true });
  const watchAddresses = configuredAddresses(chain, settings as unknown as Record<string, unknown>);
  const matchedAddress = watchAddresses.find((address) => (
    chain === WalletChain.ethereum || chain === WalletChain.bsc || chain === WalletChain.polygon
      ? address.toLowerCase() === destination.toLowerCase()
      : address === destination
  ));
  if (!matchedAddress) return NextResponse.json({ received: true, ignored: true });

  const asset = assetValue.slice(0, 64);
  const sourceValue = event.from ?? event.counterAddress;
  const tokenAddressValue = event.contractAddress ?? event.tokenId;
  const blockNumberValue = event.blockNumber;
  const admins = await prisma.user.findMany({
    where: { isAdmin: true, isBanned: false },
    select: { id: true },
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.chainDeposit.create({
        data: {
          chain,
          txHash,
          destination: matchedAddress,
          sourceAddress: typeof sourceValue === 'string' ? sourceValue.slice(0, 128) : null,
          asset,
          tokenAddress: typeof tokenAddressValue === 'string' ? tokenAddressValue.slice(0, 128) : null,
          amount,
          blockNumber: typeof blockNumberValue === 'string' || typeof blockNumberValue === 'number'
            ? String(blockNumberValue).slice(0, 64)
            : null,
          status: 'detected',
          providerPayload: body as object,
        },
      });

      if (admins.length > 0) {
        const directionKnown = typeof event.to === 'string';
        const statusText = directionKnown
          ? 'An incoming on-chain transfer was detected. Verify confirmations before processing.'
          : 'Wallet activity was detected. Verify the direction and confirmations on-chain.';
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            recipientType: 'admin',
            title: 'On-chain activity detected',
            message: `${amount} ${asset} on ${chain} — ${statusText}`,
            link: '/admin/history',
          })),
        });
      }
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error('TATUM WEBHOOK ERROR:', error);
    return NextResponse.json({ error: 'Could not record blockchain event.' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}