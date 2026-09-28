'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck, Trash2, Wallet } from 'lucide-react';
import { getToken } from '@/app/lib/auth';

type Chain = 'ethereum' | 'bsc' | 'polygon' | 'tron' | 'bitcoin';
type LinkedWallet = { id: string; chain: Chain; address: string; verifiedAt: string };
type Holding = { asset: string; name: string; amount: string; usdValue: number; ghsValue: number };
type WalletBalance = { walletId: string; holdings: Holding[]; error: string | null };
type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  providers?: Eip1193Provider[];
  on?: (event: string, listener: () => void) => void;
  removeListener?: (event: string, listener: () => void) => void;
};
type EvmWalletApp = 'metamask' | 'trust' | 'other';
type WalletApi = {
  request?: (args: { method: string }) => Promise<unknown>;
};
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
    tronLink?: WalletApi;
    tronWeb?: TronProvider;
    unisat?: UnisatProvider;
  }
}

const CHAIN_LABELS: Record<Chain, string> = {
  ethereum: 'Ethereum',
  bsc: 'BNB Smart Chain',
  polygon: 'Polygon',
  tron: 'Tron',
  bitcoin: 'Bitcoin',
};

const EVM_CONFIG: Record<'ethereum' | 'bsc' | 'polygon', { chainId: string; label: string; rpcUrl: string; explorer: string; currency: string }> = {
  ethereum: { chainId: '0x1', label: 'Ethereum Mainnet', rpcUrl: 'https://cloudflare-eth.com', explorer: 'https://etherscan.io', currency: 'ETH' },
  bsc: { chainId: '0x38', label: 'BNB Smart Chain', rpcUrl: 'https://bsc-dataseed.binance.org', explorer: 'https://bscscan.com', currency: 'BNB' },
  polygon: { chainId: '0x89', label: 'Polygon', rpcUrl: 'https://polygon-rpc.com', explorer: 'https://polygonscan.com', currency: 'POL' },
};

const CHAIN_OPTIONS: Chain[] = ['ethereum', 'bsc', 'polygon', 'tron', 'bitcoin'];

function getEvmProvider(app: EvmWalletApp): Eip1193Provider | undefined {
  const injected = window.ethereum;
  const candidates = [...(injected?.providers ?? []), ...(injected ? [injected] : [])];
  const providers = [...new Set(candidates)];
  if (app === 'other') {
    return providers.find((provider) => !provider.isMetaMask && !provider.isTrust && !provider.isTrustWallet)
      ?? providers[0];
  }

  const selected = app === 'metamask'
    ? providers.find((provider) => provider.isMetaMask && !provider.isTrust)
    : providers.find((provider) => provider.isTrust || provider.isTrustWallet);
  if (selected) return selected;
  if (providers.length === 1) {
    const onlyProvider = providers[0];
    if (app === 'metamask' && onlyProvider.isMetaMask && !onlyProvider.isTrust) return onlyProvider;
    if (app === 'trust' && (onlyProvider.isTrust || onlyProvider.isTrustWallet)) return onlyProvider;
  }
  return undefined;
}

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function walletBrowserUrl(app: EvmWalletApp) {
  const currentUrl = `${window.location.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (app === 'metamask') {
    return `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}${window.location.search}${window.location.hash}`;
  }
  if (app === 'trust') {
    return `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(currentUrl)}`;
  }
  return currentUrl;
}

function authHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() ?? ''}` };
}

function formatGhs(value: number) {
  return `GHS ${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortAddress(address: string) {
  return address.length > 22 ? `${address.slice(0, 10)}…${address.slice(-8)}` : address;
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return typeof body.error === 'string' ? body.error : fallback;
}

export default function WalletsPage() {
  const router = useRouter();
  const [chain, setChain] = useState<Chain>('ethereum');
  const [walletApp, setWalletApp] = useState<EvmWalletApp>('metamask');
  const [showCreateWalletHelp, setShowCreateWalletHelp] = useState(false);
  const [wallets, setWallets] = useState<LinkedWallet[]>([]);
  const [balances, setBalances] = useState<Record<string, WalletBalance>>({});
  const [ghsPerUsd, setGhsPerUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [providerReady, setProviderReady] = useState(false);
  const [mobileBrowser, setMobileBrowser] = useState(false);

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
    void loadWallets();
  }, [loadWallets]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provider = params.get('wallet');
    if (provider === 'metamask' || provider === 'trust' || provider === 'other') {
      setWalletApp(provider);
    }
    setShowCreateWalletHelp(params.get('setup') === 'create');
  }, []);

  useEffect(() => {
    setMobileBrowser(isMobileBrowser());

    const refreshProviderStatus = () => {
      if (chain === 'ethereum' || chain === 'bsc' || chain === 'polygon') {
        setProviderReady(Boolean(getEvmProvider(walletApp)));
      } else {
        setProviderReady(true);
      }
    };
    const handleProviderInitialized = () => refreshProviderStatus();

    refreshProviderStatus();
    window.addEventListener('ethereum#initialized', handleProviderInitialized);
    const poll = window.setInterval(refreshProviderStatus, 1000);
    return () => {
      window.removeEventListener('ethereum#initialized', handleProviderInitialized);
      window.clearInterval(poll);
    };
  }, [chain, walletApp]);

  async function createChallenge(address: string) {
    const response = await fetch('/api/wallets/challenge', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ chain, address }),
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
      if (chain === 'ethereum' || chain === 'bsc' || chain === 'polygon') {
        const provider = getEvmProvider(walletApp);
        if (!provider) {
          const selectedName = walletApp === 'metamask' ? 'MetaMask' : 'Trust Wallet';
          throw new Error(
            walletApp === 'other'
              ? 'No compatible Ethereum wallet was detected. Open this page from your wallet app’s browser.'
              : `${selectedName} was not detected. Open this page in ${selectedName}’s browser or install its official browser extension.`,
          );
        }
        const config = EVM_CONFIG[chain];
        const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
        const address = accounts?.[0];
        if (!address) throw new Error('No wallet account was selected.');

        const currentChain = await provider.request({ method: 'eth_chainId' }) as string;
        if (currentChain.toLowerCase() !== config.chainId) {
          try {
            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: config.chainId }],
            });
          } catch (switchError) {
            if (typeof switchError !== 'object' || switchError === null || !('code' in switchError) || switchError.code !== 4902) {
              throw switchError;
            }
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: config.chainId,
                chainName: config.label,
                nativeCurrency: {
                  name: config.currency,
                  symbol: config.currency,
                  decimals: 18,
                },
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
        if (!window.tronLink?.request || !window.tronWeb) {
          throw new Error('Install TronLink, then reopen this page in the TronLink browser.');
        }
        await window.tronLink.request({ method: 'tron_requestAccounts' });
        const address = window.tronWeb.defaultAddress?.base58;
        const signMessage = window.tronWeb.trx?.signMessageV2;
        if (!address || !signMessage) throw new Error('TronLink did not provide an account and signing method.');
        await verifyAndSave(address, (message) => signMessage(message));
      } else {
        if (!window.unisat) throw new Error('Install UniSat or a compatible Bitcoin wallet, then reopen this page in that wallet’s browser.');
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
    if (walletApp === 'other') return;
    window.location.assign(walletBrowserUrl(walletApp));
  }

  async function unlinkWallet(wallet: LinkedWallet) {
    if (!window.confirm(`Unlink this ${CHAIN_LABELS[wallet.chain]} wallet?`)) return;
    setUnlinking(wallet.id);
    setError('');
    try {
      const response = await fetch(`/api/wallets/linked?id=${encodeURIComponent(wallet.id)}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
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
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-green-700">Your wallets</p>
            <h1 className="mt-1 text-3xl font-bold text-green-950">Connect a wallet</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-600">
              Connect a wallet you control to view public balances and their estimated value in Ghana cedis.
              Exspend never receives your recovery phrase or private keys.
            </p>
          </div>
          <Link href="/history" className="text-sm font-semibold text-green-800 underline underline-offset-4">
            View spending and transfer history
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-green-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-xl bg-green-50 p-2 text-green-800"><Wallet size={22} /></span>
            <div>
              <h2 className="font-semibold text-gray-900">Connect your wallet</h2>
              <p className="text-xs text-gray-500">A one-time signature proves address ownership; it cannot move funds or approve a transaction.</p>
            </div>
          </div>

          {showCreateWalletHelp && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              <p className="font-semibold">Create your wallet with its official provider first</p>
              <p className="mt-1 text-xs">
                Create it in the wallet app, keep its recovery phrase private and offline, then return here and connect it. Do not use your Exspend password or email as a wallet recovery method.
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold underline">
                <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">MetaMask official download</a>
                <a href="https://trustwallet.com/download" target="_blank" rel="noopener noreferrer">Trust Wallet official download</a>
              </div>
            </div>
          )}

          <label className="mb-3 block text-sm font-medium text-gray-700">
            Wallet app for Ethereum-compatible networks
            <select
              value={walletApp}
              onChange={(event) => setWalletApp(event.target.value as EvmWalletApp)}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm"
            >
              <option value="metamask">MetaMask</option>
              <option value="trust">Trust Wallet</option>
              <option value="other">Another compatible wallet</option>
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="text-sm font-medium text-gray-700">
              Network
              <select
                value={chain}
                onChange={(event) => setChain(event.target.value as Chain)}
                className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm"
              >
                {CHAIN_OPTIONS.map((option) => <option value={option} key={option}>{CHAIN_LABELS[option]}</option>)}
              </select>
            </label>
            <button
              type="button"
              onClick={connectWallet}
               disabled={connecting}
              className="self-end rounded-xl bg-green-800 px-5 py-3 text-sm font-semibold text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
               {connecting ? <span className="flex items-center gap-2"><LoaderCircle size={16} className="animate-spin" /> Connecting…</span> : `Connect another ${CHAIN_LABELS[chain]} wallet`}
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            MetaMask, Trust Wallet, and compatible wallet apps work with Ethereum, BNB Chain, and Polygon. Use TronLink for Tron or UniSat for Bitcoin. Desktop extensions are detected automatically; on mobile, open this page inside the wallet app’s browser.
            You can also skip linking and enter a destination address when buying.
          </p>

          {(walletApp === 'metamask' || walletApp === 'trust') && !providerReady && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              <p className="font-semibold">
                {mobileBrowser ? `${walletApp === 'metamask' ? 'MetaMask' : 'Trust Wallet'} is installed but this tab is outside its browser.` : `No ${walletApp === 'metamask' ? 'MetaMask' : 'Trust Wallet'} provider is available in this tab.`}
              </p>
              <p className="mt-1 text-xs">
                {mobileBrowser
                  ? 'Use the button below to reopen this exact page inside the selected wallet. The wallet provider can only be detected there.'
                  : 'Install the official extension, or open this page in the selected wallet app on iOS or Android.'}
              </p>
              <button
                type="button"
                onClick={openWalletBrowser}
                className="mt-3 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Open in {walletApp === 'metamask' ? 'MetaMask' : 'Trust Wallet'}
              </button>
            </div>
          )}

          {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {notice && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-5">
            <div>
              <h2 className="font-semibold text-gray-900">Linked wallets and balances</h2>
              <p className="mt-1 text-xs text-gray-500">
                Estimates use live market prices and the admin sell rate{ghsPerUsd ? ` of GHS ${ghsPerUsd.toFixed(4)} per USD` : ''}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setRefreshing(true); void loadWallets(false); }}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {loading ? (
            <p className="p-6 text-sm text-gray-500">Loading your wallets…</p>
          ) : wallets.length === 0 ? (
            <div className="p-8 text-center">
              <ShieldCheck className="mx-auto mb-3 text-green-700" size={30} />
              <p className="font-semibold text-gray-800">No wallets linked yet</p>
              <p className="mt-1 text-sm text-gray-500">You can link one now or continue using external destination addresses at checkout.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {wallets.map((wallet) => {
                const balance = balances[wallet.id];
                return (
                  <div className="p-5" key={wallet.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">{CHAIN_LABELS[wallet.chain]}</h3>
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-800">
                            <CheckCircle2 size={13} /> Verified
                          </span>
                        </div>
                        <p className="mt-1 break-all font-mono text-xs text-gray-500" title={wallet.address}>{shortAddress(wallet.address)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void unlinkWallet(wallet)}
                        disabled={unlinking === wallet.id}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900 disabled:opacity-50"
                      >
                        <Trash2 size={14} /> {unlinking === wallet.id ? 'Unlinking…' : 'Unlink'}
                      </button>
                    </div>

                    {balance?.error ? (
                      <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{balance.error}</p>
                    ) : (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {(balance?.holdings ?? []).map((holding) => (
                          <div key={`${wallet.id}-${holding.asset}`} className="rounded-xl bg-gray-50 p-3">
                            <p className="text-xs font-medium text-gray-500">{holding.name} · {holding.asset}</p>
                            <p className="mt-1 font-semibold text-gray-900">{Number(holding.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })} {holding.asset}</p>
                            <p className="mt-1 text-sm text-green-800">{formatGhs(holding.ghsValue)}</p>
                          </div>
                        ))}
                        {balance && balance.holdings.length === 0 && (
                          <p className="text-sm text-gray-500">No supported assets found for this address.</p>
                        )}
                        {!balance && <p className="text-sm text-gray-500">Balance is not available yet.</p>}
                      </div>
                    )}
                    <a
                      href={`${wallet.chain === 'ethereum' ? 'https://etherscan.io/address' : wallet.chain === 'bsc' ? 'https://bscscan.com/address' : wallet.chain === 'polygon' ? 'https://polygonscan.com/address' : wallet.chain === 'tron' ? 'https://tronscan.org/#/address' : 'https://blockstream.info/address'}/${encodeURIComponent(wallet.address)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-green-800 underline"
                    >
                      View on block explorer <ArrowUpRight size={13} />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
          <div className="border-t border-gray-100 px-5 py-4 text-xs text-gray-500">
            Balance data comes from public blockchain services and can be delayed or rate-limited. Cedi values are estimates, not an executable quote.
          </div>
        </section>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Never share your seed phrase or approve a transaction to link a wallet. Exspend only asks you to sign a one-time ownership message.
        </div>
      </div>
    </main>
  );
}