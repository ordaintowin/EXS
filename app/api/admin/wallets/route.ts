// GET /api/admin/wallets — return current wallet settings (admin only)
// PATCH /api/admin/wallets — update wallet settings (admin only)
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/api/lib/prisma';
import { getAuthenticatedAdmin } from '@/app/api/lib/auth';

const MONITORED_ADDRESS_FIELDS = [
  'USDT_ERC20',
  'USDT_TRC20',
  'USDT_BEP20',
  'USDT_POLYGON',
  'USDC_BEP20',
  'USDC_ERC20',
  'USDC_POLYGON',
  'BTC',
  'BNB',
  'ETH',
] as const;

function getDepositAlertReadiness(settings: Record<string, unknown> | null) {
  const configuredAddressCount = settings
    ? MONITORED_ADDRESS_FIELDS.filter((field) => (
        typeof settings[field] === 'string' && (settings[field] as string).trim().length > 0
      )).length
    : 0;
  return {
    signatureSecretConfigured: Boolean(process.env.TATUM_HMAC_SECRET),
    configuredAddressCount,
  };
}

export async function GET(request: NextRequest) {
  if (!(await getAuthenticatedAdmin(request))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const settings = await prisma.walletSettings.findUnique({ where: { id: 'singleton' } });
    const wallets = settings ?? {
      USDT_ERC20: '',
      USDT_TRC20: '',
      USDT_BEP20: '',
      USDT_POLYGON: '',
      USDC_ERC20: '',
      USDC_BEP20: '',
      USDC_POLYGON: '',
      BTC: '',
      BNB: '',
      ETH: '',
      BINANCE_PAY: '',
      BYBIT_PAY: '',
    };
    return NextResponse.json({
      wallets,
      depositAlerts: getDepositAlertReadiness(wallets),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch wallet settings' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await getAuthenticatedAdmin(request))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const fields = [
      'USDT_ERC20', 'USDT_TRC20', 'USDT_BEP20', 'USDT_POLYGON',
      'USDC_ERC20', 'USDC_BEP20', 'USDC_POLYGON',
      'BTC', 'BNB', 'ETH',
      'BINANCE_PAY', 'BYBIT_PAY',
    ] as const;

    const data: Record<string, string> = {};
    for (const field of fields) {
      if (typeof body[field] === 'string') {
        data[field] = body[field];
      }
    }

    const settings = await prisma.walletSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    });

    return NextResponse.json({
      wallets: settings,
      depositAlerts: getDepositAlertReadiness(settings),
    });
  } catch {
    return NextResponse.json({ error: 'Failed to update wallet settings' }, { status: 500 });
  }
}
