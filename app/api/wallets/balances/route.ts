import { NextRequest, NextResponse } from 'next/server';
import { formatUnits, isAddress } from 'ethers';
import { getTokenFromRequest, verifyToken } from '@/app/api/lib/jwt';
import { prisma } from '@/app/api/lib/prisma';

export const dynamic = 'force-dynamic';

type Holding = {
  asset: string;
  name: string;
  amount: string;
  usdValue: number;
  ghsValue: number;
};

type Token = { asset: string; name: string; address: string; decimals: number };
type ChainConfig = {
  nativeAsset: string;
  nativeName: string;
  rpc: string;
  tokens: Token[];
};

const CHAIN_CONFIG: Record<'ethereum' | 'bsc' | 'polygon', ChainConfig> = {
  ethereum: {
    nativeAsset: 'ETH',
    nativeName: 'Ethereum',
    rpc: 'https://cloudflare-eth.com',
    tokens: [
      { asset: 'USDT', name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
      { asset: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    ],
  },
  bsc: {
    nativeAsset: 'BNB',
    nativeName: 'BNB',
    rpc: 'https://bsc-dataseed.binance.org',
    tokens: [
      { asset: 'USDT', name: 'Tether USD', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
      { asset: 'USDC', name: 'USD Coin', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
    ],
  },
  polygon: {
    nativeAsset: 'POL',
    nativeName: 'Polygon',
    rpc: 'https://polygon-rpc.com',
    tokens: [
      { asset: 'USDT', name: 'Tether USD', address: '0xc2132D05D31c914a87C6611C10748AaCbAe1FfC6', decimals: 6 },
      { asset: 'USDC', name: 'USD Coin', address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', decimals: 6 },
      { asset: 'USDC.e', name: 'Bridged USD Coin', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
    ],
  },
};

const COINGECKO_IDS = [
  'bitcoin',
  'ethereum',
  'binancecoin',
  'polygon-ecosystem-token',
  'tron',
  'tether',
  'usd-coin',
].join(',');

async function rpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Blockchain RPC returned ${response.status}.`);
  const body = await response.json();
  if (body.error || body.result === undefined) throw new Error('Blockchain RPC could not read this address.');
  return body.result as T;
}

function tokenBalanceCall(walletAddress: string): string {
  return `0x70a08231${walletAddress.slice(2).toLowerCase().padStart(64, '0')}`;
}

async function evmHoldings(
  chain: 'ethereum' | 'bsc' | 'polygon',
  walletAddress: string,
): Promise<Array<{ asset: string; name: string; amount: string }>> {
  const config = CHAIN_CONFIG[chain];
  const nativeHex = await rpc<string>(config.rpc, 'eth_getBalance', [walletAddress, 'latest']);
  const tokenRows = await Promise.all(config.tokens.map(async (token) => {
    const raw = await rpc<string>(config.rpc, 'eth_call', [
      { to: token.address, data: tokenBalanceCall(walletAddress) },
      'latest',
    ]);
    return { asset: token.asset, name: token.name, amount: formatUnits(BigInt(raw), token.decimals) };
  }));
  return [
    { asset: config.nativeAsset, name: config.nativeName, amount: formatUnits(BigInt(nativeHex), 18) },
    ...tokenRows,
  ];
}

async function tronHoldings(address: string): Promise<Array<{ asset: string; name: string; amount: string }>> {
  const response = await fetch(`https://api.trongrid.io/v1/accounts/${encodeURIComponent(address)}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Tron balance service returned ${response.status}.`);
  const result = await response.json();
  const account = result.data?.[0];
  const tokenMap: Record<string, string> = {};
  for (const entry of account?.trc20 ?? []) Object.assign(tokenMap, entry);
  const rawUsdt = tokenMap.TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t ?? '0';

  return [
    { asset: 'TRX', name: 'TRON', amount: formatUnits(BigInt(account?.balance ?? 0), 6) },
    { asset: 'USDT', name: 'Tether USD', amount: formatUnits(BigInt(rawUsdt), 6) },
  ];
}

async function bitcoinHoldings(address: string): Promise<Array<{ asset: string; name: string; amount: string }>> {
  const response = await fetch(`https://blockstream.info/api/address/${encodeURIComponent(address)}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Bitcoin balance service returned ${response.status}.`);
  const result = await response.json();
  const confirmed = result.chain_stats.funded_txo_sum - result.chain_stats.spent_txo_sum;
  const unconfirmed = result.mempool_stats.funded_txo_sum - result.mempool_stats.spent_txo_sum;
  return [{ asset: 'BTC', name: 'Bitcoin', amount: formatUnits(BigInt(confirmed + unconfirmed), 8) }];
}

function priceId(asset: string): string {
  if (asset === 'BTC') return 'bitcoin';
  if (asset === 'ETH') return 'ethereum';
  if (asset === 'BNB') return 'binancecoin';
  if (asset === 'POL') return 'polygon-ecosystem-token';
  if (asset === 'TRX') return 'tron';
  if (asset === 'USDT') return 'tether';
  return 'usd-coin';
}

export async function GET(request: NextRequest) {
  const token = getTokenFromRequest(request);
  const user = token ? verifyToken(token) : null;
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [wallets, settings, latestRate] = await Promise.all([
      prisma.linkedWallet.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, chain: true, address: true },
      }),
      prisma.walletSettings.findUnique({ where: { id: 'singleton' }, select: { sellRateGhsPerUsd: true } }),
      prisma.exchangeRate.findFirst({ orderBy: { createdAt: 'desc' }, select: { ghsPerUsd: true } }),
    ]);

    const ghsPerUsd = settings?.sellRateGhsPerUsd ?? latestRate?.ghsPerUsd;
    if (!ghsPerUsd || !Number.isFinite(ghsPerUsd) || ghsPerUsd <= 0) {
      return NextResponse.json({ error: 'The admin has not set a valid GHS exchange rate yet.' }, { status: 503 });
    }
    if (wallets.length === 0) return NextResponse.json({ ghsPerUsd, wallets: [] });

    const balances = await Promise.all(wallets.map(async (wallet) => {
      try {
        let rows: Array<{ asset: string; name: string; amount: string }>;
        if (wallet.chain === 'ethereum' || wallet.chain === 'bsc' || wallet.chain === 'polygon') {
          if (!isAddress(wallet.address)) throw new Error('Stored EVM address is invalid.');
          rows = await evmHoldings(wallet.chain, wallet.address);
        } else if (wallet.chain === 'tron') {
          rows = await tronHoldings(wallet.address);
        } else {
          rows = await bitcoinHoldings(wallet.address);
        }
        return { walletId: wallet.id, holdings: rows, error: null as string | null };
      } catch (error) {
        return {
          walletId: wallet.id,
          holdings: [] as Array<{ asset: string; name: string; amount: string }>,
          error: error instanceof Error ? error.message : 'Could not read this wallet balance.',
        };
      }
    }));

    const pricesResponse = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS}&vs_currencies=usd`,
      { cache: 'no-store', signal: AbortSignal.timeout(12_000) },
    );
    if (!pricesResponse.ok) {
      return NextResponse.json({ error: 'Live crypto prices are temporarily unavailable; balances were not converted.' }, { status: 503 });
    }
    const prices = await pricesResponse.json();

    const enriched = balances.map((wallet) => ({
      ...wallet,
      holdings: wallet.holdings.map((holding): Holding => {
        const usdPerCoin = prices[priceId(holding.asset)]?.usd;
        const amount = Number(holding.amount);
        if (typeof usdPerCoin !== 'number' || !Number.isFinite(amount)) {
          throw new Error(`A live price is unavailable for ${holding.asset}.`);
        }
        const usdValue = amount * usdPerCoin;
        return {
          ...holding,
          usdValue,
          ghsValue: usdValue * ghsPerUsd,
        };
      }),
    }));

    return NextResponse.json({ ghsPerUsd, wallets: enriched, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error('WALLET BALANCE ERROR:', error);
    return NextResponse.json({ error: 'Could not load wallet balances.' }, { status: 500 });
  }
}