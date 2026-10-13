'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Link2,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wallet,
} from 'lucide-react';
import { getToken } from '@/app/lib/auth';

type Chain = 'ethereum' | 'bsc' | 'polygon' | 'tron' | 'bitcoin';
type LinkedWallet = { id: string; chain: Chain; asset: string; provider?: string; address: string; verifiedAt: string };
type Holding = { asset: string; name: string; amount: string; usdValue: number; ghsValue: number };
type WalletBalance = { walletId: string; chain: Chain; asset: string; provider?: string; address: string; holdings: Holding[]; error: string | null };
type WalletApp = 'metamask' | 'trust' | 'binance' | 'bybit' | 'blockchain';
type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isBinance?: boolean;
  isBinanceChain?: boolean;
  isBybit?: boolean;
  isBybitWallet?: boolean;
  providers?: Eip1193Provider[];
};
type DiscoveredProvider = {
  info: { name?: string; rdns?: string; icon?: string; uuid?: string };
  provider: Eip1193Provider;
};
type WalletApi = { request?: (args: { method: string }) => Promise<unknown> };
type TronProvider = {
  defaultAddress?: { base58?: string };
  trx?: { signMessageV2?: (message: string) => Promise<string> };
};
type UnisatProvider = {
  requestAccounts: () => Promise<string[]>;
  signMessage: (message: string, type?: string) => Promise<string>;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    BinanceChain?: Eip1193Provider;
    binancew3w?: { ethereum?: Eip1193Provider };
    bybitWallet?: Eip1193Provider;
    blockchain?: { ethereum?: Eip1193Provider; provider?: Eip1193Provider };
    tronLink?: WalletApi;
    tronWeb?: TronProvider;
    unisat?: UnisatProvider;
  }
}

const CHAIN_LABELS: Record<Chain, string> = {
  ethereum: 'Ethereum',
  bsc: 'BNB Chain',
  polygon: 'Polygon',
  tron: 'Tron',
  bitcoin: 'Bitcoin',
};

const CHAIN_DETAILS: Record<Chain, { short: string; className: string; explorer: string }> = {
  ethereum: { short: 'ETH', className: 'bg-indigo-50 text-indigo-700 ring-indigo-100', explorer: 'https://etherscan.io/address' },
  bsc: { short: 'BNB', className: 'bg-amber-50 text-amber-700 ring-amber-100', explorer: 'https://bscscan.com/address' },
  polygon: { short: 'POL', className: 'bg-violet-50 text-violet-700 ring-violet-100', explorer: 'https://polygonscan.com/address' },
  tron: { short: 'TRX', className: 'bg-red-50 text-red-700 ring-red-100', explorer: 'https://tronscan.org/#/address' },
  bitcoin: { short: 'BTC', className: 'bg-orange-50 text-orange-700 ring-orange-100', explorer: 'https://blockstream.info/address' },
};

const EVM_CONFIG: Record<'ethereum' | 'bsc' | 'polygon', { chainId: string; label: string; rpcUrl: string; explorer: string; currency: string }> = {
  ethereum: { chainId: '0x1', label: 'Ethereum Mainnet', rpcUrl: 'https://cloudflare-eth.com', explorer: 'https://etherscan.io', currency: 'ETH' },
  bsc: { chainId: '0x38', label: 'BNB Smart Chain', rpcUrl: 'https://bsc-dataseed.binance.org', explorer: 'https://bscscan.com', currency: 'BNB' },
  polygon: { chainId: '0x89', label: 'Polygon Mainnet', rpcUrl: 'https://polygon-rpc.com', explorer: 'https://polygonscan.com', currency: 'POL' },
};

const CHAIN_OPTIONS: Chain[] = ['ethereum', 'bsc', 'polygon', 'tron', 'bitcoin'];
const EVM_CHAINS = new Set<Chain>(['ethereum', 'bsc', 'polygon']);
const ASSETS_BY_CHAIN: Record<Chain, Array<{ value: string; label: string }>> = {
  ethereum: [{ value: 'ETH', label: 'ETH' }, { value: 'USDT', label: 'USDT' }, { value: 'USDC', label: 'USDC' }],
  bsc: [{ value: 'BNB', label: 'BNB' }, { value: 'USDT', label: 'USDT' }, { value: 'USDC', label: 'USDC' }],
  polygon: [{ value: 'POL', label: 'POL' }, { value: 'USDT', label: 'USDT' }, { value: 'USDC', label: 'USDC' }],
  tron: [{ value: 'USDT', label: 'USDT' }],
  bitcoin: [{ value: 'BTC', label: 'BTC' }],
};
const ASSET_CARD_COLORS: Record<string, string> = {
  BTC: 'border-orange-200 bg-orange-50/40',
  ETH: 'border-indigo-200 bg-indigo-50/40',
  BNB: 'border-amber-200 bg-amber-50/40',
  USDT: 'border-emerald-200 bg-emerald-50/40',
  USDC: 'border-blue-200 bg-blue-50/40',
  POL: 'border-violet-200 bg-violet-50/40',
};

const WALLET_APPS: Array<{
  id: WalletApp;
  name: string;
  description: string;
  mark: string;
  markClass: string;
}> = [
  { id: 'metamask', name: 'MetaMask', description: 'Browser or mobile wallet', mark: 'M', markClass: 'bg-orange-100 text-orange-700' },
  { id: 'trust', name: 'Trust Wallet', description: 'Mobile-first wallet', mark: 'T', markClass: 'bg-sky-100 text-sky-700' },
  { id: 'binance', name: 'Binance Wallet', description: 'Binance Web3 wallet', mark: 'B', markClass: 'bg-yellow-100 text-yellow-800' },
  { id: 'bybit', name: 'Bybit Wallet', description: 'Bybit Web3 wallet', mark: 'Y', markClass: 'bg-slate-200 text-slate-800' },
  { id: 'blockchain', name: 'Blockchain.com', description: 'Blockchain.com Wallet', mark: 'BC', markClass: 'bg-blue-100 text-blue-700' },
];

function isEvmChain(chain: Chain): chain is 'ethereum' | 'bsc' | 'polygon' {
  return EVM_CHAINS.has(chain);
}

function providerApp(info: DiscoveredProvider['info']): WalletApp | null {
  const identity = `${info.name ?? ''} ${info.rdns ?? ''}`.toLowerCase();
  if (identity.includes('metamask') || identity.includes('io.metamask')) return 'metamask';
  if (identity.includes('trust')) return 'trust';
  if (identity.includes('binance')) return 'binance';
  if (identity.includes('bybit')) return 'bybit';
  if (identity.includes('blockchain')) return 'blockchain';
  return null;
}

function getEvmProvider(app: WalletApp, discoveredProviders: DiscoveredProvider[] = []): Eip1193Provider | undefined {
  if (typeof window === 'undefined') return undefined;
  const injected = window.ethereum;
  const directProviders = app === 'binance'
    ? [window.BinanceChain, window.binancew3w?.ethereum]
    : app === 'bybit'
      ? [window.bybitWallet]
      : app === 'blockchain'
        ? [window.blockchain?.ethereum, window.blockchain?.provider]
        : [];
  const announced = discoveredProviders
    .filter((entry) => providerApp(entry.info) === app)
    .map((entry) => entry.provider);
  const candidates = [
    ...announced,
    ...(injected?.providers ?? []),
    ...(injected ? [injected] : []),
    ...directProviders.filter((provider): provider is Eip1193Provider => Boolean(provider)),
  ];
  const providers = [...new Set(candidates)];
  if (announced.length > 0) return announced[0];

  if (app === 'metamask') return providers.find((provider) => provider.isMetaMask && !provider.isTrust);
  if (app === 'trust') return providers.find((provider) => provider.isTrust || provider.isTrustWallet);
  if (app === 'binance') return providers.find((provider) => provider.isBinance || provider.isBinanceChain || provider === window.BinanceChain);
  if (app === 'bybit') return providers.find((provider) => provider.isBybit || provider.isBybitWallet || provider === window.bybitWallet);
  return providers.find((provider) => provider === window.blockchain?.ethereum || provider === window.blockchain?.provider)
    ?? (announced.length > 0 ? announced[0] : undefined);
}

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function walletBrowserUrl(app: WalletApp) {
  const currentUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (app === 'metamask') return `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (app === 'trust') return `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(currentUrl)}`;
  if (app === 'binance') return 'https://www.binance.com/en/web3wallet';
  if (app === 'bybit') return 'https://www.bybit.com/en/web3';
  return 'https://www.blockchain.com/wallet';
}

function authHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() ?? ''}` };
}

function formatGhs(value: number) {
  return `GHS ${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUsd(value: number) {
  return `≈ $${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatAmount(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function shortAddress(address: string) {
  return address.length > 22 ? `${address.slice(0, 10)}…${address.slice(-8)}` : address;
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === 'string' ? body.error : fallback;
}

function WalletMark({ app, className = '' }: { app: WalletApp; className?: string }) {
  const detail = WALLET_APPS.find((wallet) => wallet.id === app) ?? WALLET_APPS[4];
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black shadow-sm ${detail.markClass} ${className}`}>
      {detail.mark}
    </span>
  );
}

export default function WalletsPage() {
  const router = useRouter();
  const [chain, setChain] = useState<Chain>('ethereum');
  const [asset, setAsset] = useState('ETH');
  const [showCreateWalletHelp] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('setup') === 'create';
  });
  const [wallets, setWallets] = useState<LinkedWallet[]>([]);
  const [balances, setBalances] = useState<Record<string, WalletBalance>>({});
  const [ghsPerUsd, setGhsPerUsd] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [providerDetected, setProviderDetected] = useState(false);
  const [discoveredProviders, setDiscoveredProviders] = useState<DiscoveredProvider[]>([]);
  const mobileBrowser = typeof window !== 'undefined' && isMobileBrowser();
  const availableWalletApps = useMemo(
    () => WALLET_APPS.filter((app) => Boolean(getEvmProvider(app.id, discoveredProviders))),
    [discoveredProviders],
  );
  const providerReady = !isEvmChain(chain) || providerDetected;

  const loadWallets = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError('');
    try {
      const [walletResponse, balanceResponse] = await Promise.all([
        fetch('/api/wallets/linked', { headers: authHeaders(), cache: 'no-store' }),
        fetch('/api/wallets/balances', { headers: authHeaders(), cache: 'no-store' }),
      ]);
      if (walletResponse.status === 401 || balanceResponse.status === 401) {
        router.replace('/login');
        return;
      }
      if (!walletResponse.ok) throw new Error(await responseError(walletResponse, 'Could not load linked wallets.'));
      const walletData = await walletResponse.json();
      setWallets(walletData.wallets ?? []);

      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        setGhsPerUsd(balanceData.ghsPerUsd ?? null);
        setUpdatedAt(balanceData.updatedAt ?? null);
        setBalances(Object.fromEntries((balanceData.wallets ?? []).map((item: WalletBalance) => [item.walletId, item])));
      } else {
        setBalances({});
        setError(await responseError(balanceResponse, 'Balances are temporarily unavailable.'));
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load wallets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadWallets(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadWallets]);

  const [walletApp, setWalletApp] = useState<WalletApp>(() => {
    if (typeof window === 'undefined') return 'metamask';
    const provider = new URLSearchParams(window.location.search).get('wallet');
    return provider === 'metamask' || provider === 'trust' || provider === 'binance' || provider === 'bybit' || provider === 'blockchain'
      ? provider
      : 'metamask';
  });

  useEffect(() => {
    const announceProvider = (event: Event) => {
      const detail = (event as CustomEvent<DiscoveredProvider>).detail;
      if (!detail?.provider) return;
      setDiscoveredProviders((current) => {
        const key = detail.info?.uuid ?? detail.info?.rdns ?? detail.info?.name;
        if (!key || current.some((entry) => (entry.info?.uuid ?? entry.info?.rdns ?? entry.info?.name) === key)) return current;
        return [...current, detail];
      });
    };
    const refreshProviderStatus = () => setProviderDetected(Boolean(getEvmProvider(walletApp, discoveredProviders)));
    const handleProviderInitialized = () => refreshProviderStatus();
    window.addEventListener('eip6963:announceProvider', announceProvider);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    const initialCheck = window.setTimeout(refreshProviderStatus, 0);
    window.addEventListener('ethereum#initialized', handleProviderInitialized);
    const poll = window.setInterval(refreshProviderStatus, 1000);
    return () => {
      window.clearTimeout(initialCheck);
      window.removeEventListener('eip6963:announceProvider', announceProvider);
      window.removeEventListener('ethereum#initialized', handleProviderInitialized);
      window.clearInterval(poll);
    };
  }, [chain, walletApp, discoveredProviders]);

  useEffect(() => {
    if (availableWalletApps.length > 0 && !availableWalletApps.some((app) => app.id === walletApp)) {
      setWalletApp(availableWalletApps[0].id);
    }
  }, [availableWalletApps, walletApp]);

  const walletSummaries = useMemo(() => wallets.map((wallet) => {
    const balance = balances[wallet.id];
    const holdings = (balance?.holdings ?? []).filter((holding) => Number(holding.amount) > 0);
    return {
      wallet,
      balance,
      holdings,
      ghs: holdings.reduce((total, holding) => total + (holding.ghsValue || 0), 0),
      usd: holdings.reduce((total, holding) => total + (holding.usdValue || 0), 0),
      assets: holdings.filter((holding) => Number(holding.amount) > 0).length,
    };
  }), [wallets, balances]);

  const portfolio = useMemo(() => ({
    ghs: walletSummaries.reduce((total, wallet) => total + wallet.ghs, 0),
    usd: walletSummaries.reduce((total, wallet) => total + wallet.usd, 0),
    assets: walletSummaries.reduce((total, wallet) => total + wallet.assets, 0),
  }), [walletSummaries]);

  async function createChallenge(address: string) {
    const response = await fetch('/api/wallets/challenge', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ chain, asset, provider: walletApp, address }),
    });
    if (!response.ok) throw new Error(await responseError(response, 'Could not start wallet verification.'));
    const data = await response.json();
    return data.challenge as { id: string; message: string };
  }

  async function verifyAndSave(address: string, sign: (message: string) => Promise<string>) {
    const challenge = await createChallenge(address);
    const signature = await sign(challenge.message);
    const response = await fetch('/api/wallets/verify', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ challengeId: challenge.id, signature }),
    });
    if (!response.ok) throw new Error(await responseError(response, 'Wallet ownership verification failed.'));
    await loadWallets(false);
    setNotice(`${CHAIN_LABELS[chain]} wallet linked and verified.`);
  }

  async function connectWallet() {
    setConnecting(true);
    setError('');
    setNotice('');
    try {
      if (isEvmChain(chain)) {
        const provider = getEvmProvider(walletApp);
        if (!provider) {
          const selectedName = WALLET_APPS.find((wallet) => wallet.id === walletApp)?.name ?? 'Compatible wallet';
          throw new Error(
            `${selectedName} was not detected. Open this page in ${selectedName}’s browser or install its official browser extension.`,
          );
        }
        const config = EVM_CONFIG[chain];
        const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
        const address = accounts?.[0];
        if (!address) throw new Error('No wallet account was selected.');

        const currentChain = await provider.request({ method: 'eth_chainId' }) as string;
        if (currentChain.toLowerCase() !== config.chainId) {
          try {
            await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: config.chainId }] });
          } catch (switchError) {
            if (typeof switchError !== 'object' || switchError === null || !('code' in switchError) || switchError.code !== 4902) throw switchError;
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: config.chainId,
                chainName: config.label,
                nativeCurrency: { name: config.currency, symbol: config.currency, decimals: 18 },
                rpcUrls: [config.rpcUrl],
                blockExplorerUrls: [config.explorer],
              }],
            });
          }
        }
        await verifyAndSave(address, async (message) => (
          await provider.request({ method: 'personal_sign', params: [message, address] })
        ) as string);
      } else if (chain === 'tron') {
        if (!window.tronLink?.request || !window.tronWeb) throw new Error('No compatible Tron signing provider was detected. Open this page in a wallet browser that supports Tron signing.');
        await window.tronLink.request({ method: 'tron_requestAccounts' });
        const address = window.tronWeb.defaultAddress?.base58;
        const signMessage = window.tronWeb.trx?.signMessageV2;
        if (!address || !signMessage) throw new Error('The detected wallet did not provide a Tron account and signing method.');
        await verifyAndSave(address, (message) => signMessage(message));
      } else {
        if (!window.unisat) throw new Error('No compatible Bitcoin signing provider was detected. Open this page in a wallet browser that supports Bitcoin signing.');
        const accounts = await window.unisat.requestAccounts();
        const address = accounts[0];
        if (!address) throw new Error('No Bitcoin wallet account was selected.');
        await verifyAndSave(address, (message) => window.unisat!.signMessage(message, 'ecdsa'));
      }
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Wallet connection failed.');
    } finally {
      setConnecting(false);
    }
  }

  function openWalletBrowser() {
    window.location.assign(walletBrowserUrl(walletApp));
  }

  async function copyAddress(address: string) {
    await navigator.clipboard.writeText(address);
    setCopied(address);
    window.setTimeout(() => setCopied(null), 1600);
  }

  async function unlinkWallet(wallet: LinkedWallet) {
    if (!window.confirm(`Unlink this ${CHAIN_LABELS[wallet.chain]} wallet?`)) return;
    setUnlinking(wallet.id);
    setError('');
    try {
      const response = await fetch(`/api/wallets/linked?id=${encodeURIComponent(wallet.id)}`, { method: 'DELETE', headers: authHeaders() });
      if (!response.ok) throw new Error(await responseError(response, 'Could not unlink wallet.'));
      setWallets((current) => current.filter((item) => item.id !== wallet.id));
      setBalances((current) => {
        const next = { ...current };
        delete next[wallet.id];
        return next;
      });
      setNotice('Wallet unlinked.');
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : 'Could not unlink wallet.');
    } finally {
      setUnlinking(null);
    }
  }

  return (
    <main className="min-h-screen pb-16">
      <div className="mx-auto max-w-7xl">
        <section className="relative isolate overflow-hidden rounded-[28px] bg-[#062c22] px-5 py-6 text-white shadow-[0_24px_70px_rgba(6,44,34,0.18)] sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-20 -top-28 -z-10 h-72 w-72 rounded-full bg-lime-300/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 left-1/3 -z-10 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-lime-300">
                <span className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_0_5px_rgba(190,242,100,0.12)]" />
                Wallet overview
              </div>
              <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-5xl">Your portfolio, in cedis.</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-green-100/75 sm:text-base">
                Link your wallets once and see your supported assets together with a live estimate in Ghana cedis.
              </p>
            </div>
            <Link href="/learn-wallets" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-green-50 transition hover:bg-white/10">
              <ShieldCheck size={15} /> Wallet safety
            </Link>
          </div>

          <div className="mt-8">
            <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-5">
              <div className="flex items-center gap-2 text-xs font-medium text-green-100/65">
                <CircleDollarSign size={15} className="text-lime-300" /> Estimated total value
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{formatGhs(portfolio.ghs)}</p>
              <p className="mt-1 text-sm text-green-100/60">{formatUsd(portfolio.usd)} across {wallets.length} linked wallet{wallets.length === 1 ? '' : 's'}</p>

              {wallets.length > 0 && (
                <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {walletSummaries.map(({ wallet, ghs }) => {
                    const chainDetail = CHAIN_DETAILS[wallet.chain];
                    return (
                      <div key={wallet.id} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/10 px-3 py-2.5">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ring-1 ${chainDetail.className}`}>{chainDetail.short}</span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-green-50">{CHAIN_LABELS[wallet.chain]}</p>
                          <p className="text-sm font-bold text-lime-200">{formatGhs(ghs)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-green-100/60">
            <span>
              {ghsPerUsd ? `Rate: 1 USD = GHS ${ghsPerUsd.toFixed(4)} · ` : ''}
              {updatedAt ? `Prices updated ${new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Prices update when you refresh'}
            </span>
            <button
              type="button"
              onClick={() => { setRefreshing(true); void loadWallets(false); }}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 font-semibold text-green-50 transition hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh balances
            </button>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-[24px] border border-green-100 bg-white p-5 shadow-[0_16px_50px_rgba(15,61,43,0.06)] sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-900 text-lime-300"><Link2 size={21} /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-green-700">Add a wallet</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-green-950">Connect a wallet you control</h2>
                <p className="mt-1 text-sm leading-5 text-slate-500">Only a one-time ownership signature is requested. No funds move.</p>
              </div>
            </div>

            {showCreateWalletHelp && (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                <p className="font-semibold">Create your wallet with its official provider first</p>
                <p className="mt-1 text-xs leading-5">Keep your recovery phrase private and offline. Exspend will never ask for it.</p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold underline">
                  <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">MetaMask</a>
                  <a href="https://trustwallet.com/download" target="_blank" rel="noopener noreferrer">Trust Wallet</a>
                  <a href="https://www.binance.com/en/web3wallet" target="_blank" rel="noopener noreferrer">Binance Wallet</a>
                  <a href="https://www.bybit.com/en/web3" target="_blank" rel="noopener noreferrer">Bybit Wallet</a>
                <a href="https://www.blockchain.com/wallet" target="_blank" rel="noopener noreferrer">Blockchain.com</a>
                </div>
              </div>
            )}

            {isEvmChain(chain) ? (
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">Wallet apps</p>
                  <span className="text-xs text-slate-400">{availableWalletApps.length} detected here</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {WALLET_APPS.map((app) => {
                    const isAvailable = availableWalletApps.some((detected) => detected.id === app.id);
                    return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setWalletApp(app.id)}
                      disabled={!isAvailable}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        walletApp === app.id && isAvailable
                          ? 'border-green-700 bg-green-50 shadow-[0_0_0_3px_rgba(21,128,61,0.08)]'
                          : isAvailable
                            ? 'border-slate-200 bg-white hover:border-green-300 hover:bg-green-50/40'
                            : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-55'
                      }`}
                    >
                      <WalletMark app={app.id} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-slate-900">{app.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{isAvailable ? app.description : 'Not detected in this browser'}</span>
                      </span>
                      {walletApp === app.id && isAvailable && <Check size={17} className="shrink-0 text-green-700" />}
                    </button>
                    );
                  })}
                </div>
                {availableWalletApps.length === 0 && (
                  <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                    None of these wallets is injected into this browser yet. Open this page in the wallet app’s browser or install its official extension; unavailable options cannot be selected.
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-950">Native {CHAIN_LABELS[chain]} signing</p>
                <p className="mt-1 text-xs leading-5 text-amber-900/75">
                  Trust Wallet can hold BTC and TRON, but MetaMask is EVM-only. Native BTC/TRON signing is not exposed through the standard EVM provider used by these five wallets. Open a wallet browser that exposes its native signing interface, or use WalletConnect when it is available.
                </p>
              </div>
            )}

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Choose network</p>
                <span className="text-xs text-slate-400">{CHAIN_LABELS[chain]}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {CHAIN_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => { setChain(option); setAsset(ASSETS_BY_CHAIN[option][0].value); }}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      chain === option ? 'bg-green-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-green-50 hover:text-green-800'
                    }`}
                  >
                    {CHAIN_LABELS[option]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Choose asset to link</p>
                <span className="text-xs text-slate-400">One {asset} wallet on this network</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {ASSETS_BY_CHAIN[chain].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAsset(option.value)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      asset === option.value ? 'bg-green-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-green-50 hover:text-green-800'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={connectWallet}
              disabled={connecting || (isEvmChain(chain) && !providerReady)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 px-5 py-3.5 text-sm font-bold text-green-950 transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connecting ? <><LoaderCircle size={17} className="animate-spin" /> Linking wallet…</> : <><Wallet size={17} /> Link {isEvmChain(chain) ? (WALLET_APPS.find((app) => app.id === walletApp)?.name ?? 'wallet') : CHAIN_LABELS[chain]}</>}
            </button>

            {isEvmChain(chain) && !providerReady && (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
                <p className="font-semibold">
                  {mobileBrowser ? `Open this page inside ${WALLET_APPS.find((app) => app.id === walletApp)?.name ?? 'your wallet'}.` : `${WALLET_APPS.find((app) => app.id === walletApp)?.name ?? 'This wallet'} is not detected in this tab.`}
                </p>
                <p className="mt-1 text-xs leading-5 text-blue-900/75">
                  Use the official extension on desktop, or use the wallet’s in-app browser on mobile. Binance and Bybit support depends on their Web3 wallet provider being injected into this browser.
                </p>
                <button type="button" onClick={openWalletBrowser} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800">
                  Open {WALLET_APPS.find((app) => app.id === walletApp)?.name} <ExternalLink size={13} />
                </button>
              </div>
            )}

            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {notice && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
          </section>

          <aside className="rounded-[24px] bg-[#e8f4e9] p-5 text-green-950 sm:p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-green-700">
              <LockKeyhole size={15} /> Your keys stay yours
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">A clear view, not a custodial wallet.</h2>
            <p className="mt-3 text-sm leading-6 text-green-900/70">
              Exspend reads public blockchain balances. It never receives your private keys, recovery phrase, or permission to spend.
            </p>
            <div className="mt-6 space-y-4">
              {[
                ['01', 'Connect from the official wallet', 'Use a browser extension or the wallet app’s own browser.'],
                ['02', 'Sign one ownership message', 'The signature proves the address is yours and does not approve a transaction.'],
                ['03', 'See your cedi estimate', 'Values use live USD prices multiplied by your admin sell rate.'],
              ].map(([number, title, description]) => (
                <div key={number} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-900 text-[10px] font-bold text-lime-300">{number}</span>
                  <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-green-900/65">{description}</p></div>
                </div>
              ))}
            </div>
            <Link href="/learn-wallets" className="mt-7 inline-flex items-center gap-1 text-sm font-bold text-green-800 hover:text-green-950">
              Learn about safe wallet connections <ChevronRight size={16} />
            </Link>
          </aside>
        </div>

        <section className="mt-6 rounded-[24px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,61,43,0.05)]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-green-950">Wallet cards</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">Each card is one verified wallet on one network, with its value shown in Ghana cedis.</p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 px-6 py-12 text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin text-green-700" /> Loading your portfolio…</div>
          ) : wallets.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-700"><Wallet size={26} /></div>
              <p className="mt-4 font-semibold text-slate-900">Your portfolio is ready for its first wallet</p>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">Connect a detected MetaMask, Trust Wallet, Binance Wallet, Bybit Wallet, or Blockchain.com Wallet above to see balances here.</p>
            </div>
          ) : (
            <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2">
              {walletSummaries.map(({ wallet, balance, holdings, ghs: walletGhs, usd: walletUsd }) => {
                const chainDetail = CHAIN_DETAILS[wallet.chain];
                return (
                  <article key={wallet.id} className={`overflow-hidden rounded-2xl border ${ASSET_CARD_COLORS[wallet.asset] ?? 'border-slate-200 bg-[#fbfdfb]'}`}>
                    <div className="border-b border-slate-100 p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-black ring-1 ${chainDetail.className}`}>{chainDetail.short}</span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-slate-900">{wallet.asset} · {CHAIN_LABELS[wallet.chain]}</h3>
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-green-800"><CheckCircle2 size={11} /> Verified</span>
                            </div>
                             <div className="mt-1 flex flex-wrap items-center gap-1.5">
                               {wallet.provider && <span className="text-[11px] font-semibold capitalize text-slate-500">{wallet.provider}</span>}
                               <span className="text-slate-300">·</span>
                              <p className="font-mono text-xs text-slate-500" title={wallet.address}>{shortAddress(wallet.address)}</p>
                              <button type="button" onClick={() => void copyAddress(wallet.address)} className="text-slate-400 hover:text-green-700" aria-label="Copy wallet address">
                                {copied === wallet.address ? <Check size={13} className="text-green-700" /> : <Copy size={13} />}
                              </button>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void unlinkWallet(wallet)}
                          disabled={unlinking === wallet.id}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                          aria-label="Unlink wallet"
                          title="Unlink wallet"
                        >
                          {unlinking === wallet.id ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                      </div>
                      {!balance?.error && (
                        <div className="mt-5 flex items-end justify-between gap-3">
                          <div><p className="text-xs text-slate-500">Wallet value</p><p className="mt-1 text-2xl font-semibold tracking-tight text-green-950">{formatGhs(walletGhs)}</p></div>
                          <p className="text-right text-xs text-slate-500">{formatUsd(walletUsd)}<br /><span className="text-slate-400">{holdings.length} funded asset{holdings.length === 1 ? '' : 's'}</span></p>
                        </div>
                      )}
                    </div>

                    {balance?.error ? (
                      <p className="m-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">{balance.error}</p>
                    ) : (
                      <div className="p-4 sm:p-5">
                        {holdings.length > 0 ? (
                          <div className="space-y-2">
                            {holdings.map((holding) => (
                              <div key={`${wallet.id}-${holding.asset}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-100">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-[10px] font-black text-green-800">{holding.asset.slice(0, 3)}</span>
                                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{holding.name}</p><p className="text-xs text-slate-400">{holding.asset}</p></div>
                                </div>
                                <div className="text-right"><p className="text-sm font-semibold text-slate-800">{formatAmount(holding.amount)} <span className="text-xs font-medium text-slate-400">{holding.asset}</span></p><p className="text-xs text-green-700">{formatGhs(holding.ghsValue)}</p></div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No funded balances found for the supported assets on this network.</p>
                        )}
                        <a
                          href={`${chainDetail.explorer}/${encodeURIComponent(wallet.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-green-800 hover:text-green-950"
                        >
                          View on block explorer <ArrowUpRight size={13} />
                        </a>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <div className="border-t border-slate-100 px-5 py-4 text-xs leading-5 text-slate-400 sm:px-6">
            Cedi values use live market prices and your admin sell rate. Blockchain data can be delayed or rate-limited; estimates are not an executable quote.
          </div>
        </section>

        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-amber-700" />
          <p><strong>Stay safe:</strong> never share your seed phrase and never approve a transaction to link a wallet. Exspend only asks for a one-time message signature.</p>
        </div>
      </div>
    </main>
  );
}