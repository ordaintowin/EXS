'use client';

import { useEffect, useMemo, useState } from 'react';
import { getToken } from '@/app/lib/auth';

type Chain = 'ethereum' | 'bsc' | 'polygon' | 'tron' | 'bitcoin';

type Holding = {
  asset: string;
  name: string;
  amount: string;
  ghsValue: number;
};

type WalletBalance = {
  walletId: string;
  chain: Chain;
  address: string;
  holdings: Holding[];
  error: string | null;
};

type Props = {
  asset: string;
  amountGhs: number;
  cryptoAmount: string;
  value?: string;
  onChange?: (address: string) => void;
};

const CHAIN_LABELS: Record<Chain, string> = {
  ethereum: 'Ethereum',
  bsc: 'BNB Smart Chain',
  polygon: 'Polygon',
  tron: 'Tron',
  bitcoin: 'Bitcoin',
};

function chainForAsset(asset: string): Chain | null {
  if (asset === 'BTC') return 'bitcoin';
  if (asset === 'USDT_TRC20' || asset.includes('TRC-20')) return 'tron';
  if (asset === 'USDT_BEP20' || asset === 'USDC_BEP20' || asset === 'BNB' || asset.includes('BEP-20')) return 'bsc';
  if (asset === 'USDT_POLYGON' || asset === 'USDC_POLYGON' || asset.includes('Polygon')) return 'polygon';
  if (asset === 'ETH') return 'ethereum';
  return null;
}

function assetKey(asset: string): string {
  if (asset === 'BTC' || asset.startsWith('BTC')) return 'BTC';
  if (asset === 'BNB') return 'BNB';
  if (asset === 'ETH') return 'ETH';
  if (asset.includes('USDT')) return 'USDT';
  if (asset.includes('USDC')) return 'USDC';
  return asset;
}

function matchesAsset(holding: Holding, asset: string) {
  const key = assetKey(asset);
  return holding.asset === key || (key === 'USDC' && holding.asset === 'USDC.e');
}

function shortAddress(address: string) {
  return address.length > 24 ? `${address.slice(0, 10)}…${address.slice(-8)}` : address;
}

function formatAmount(amount: string) {
  const value = Number(amount);
  return Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: 8 })
    : amount;
}

export default function WalletFundingSelector({ asset, amountGhs, cryptoAmount, value, onChange }: Props) {
  const [wallets, setWallets] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [internalValue, setInternalValue] = useState('');
  const [lastAsset, setLastAsset] = useState(asset);

  const selectedValue = value ?? internalValue;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setInternalValue(localStorage.getItem('exspend_wallet_source') ?? '');
    }
  }, []);

  useEffect(() => {
    if (lastAsset !== asset) {
      setLastAsset(asset);
      setInternalValue('');
      if (typeof window !== 'undefined') localStorage.removeItem('exspend_wallet_source');
      onChange?.('');
      return;
    }
    const stored = typeof window !== 'undefined' ? localStorage.getItem('exspend_wallet_source') : null;
    if (stored && (!selectedValue || stored !== selectedValue)) {
      setInternalValue(stored);
    }
  }, [asset, lastAsset, onChange, selectedValue]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    fetch('/api/wallets/balances', {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Linked wallet balances are unavailable.');
        if (active) setWallets(data.wallets ?? []);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Linked wallet balances are unavailable.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedChain = chainForAsset(asset);
  const selectedAsset = assetKey(asset);
  const sourceOptions = useMemo(
    () => wallets.flatMap((wallet) => wallet.holdings
      .filter((holding) => wallet.chain === selectedChain && matchesAsset(holding, asset))
      .map((holding) => ({ wallet, holding }))),
    [asset, selectedChain, wallets],
  );
  const selected = sourceOptions.find(({ wallet }) => wallet.address === selectedValue);
  const requiredCrypto = Number(cryptoAmount);
  const selectedAmount = selected ? Number(selected.holding.amount) : 0;
  const selectedHasEnough = !selected || !Number.isFinite(requiredCrypto) || selectedAmount >= requiredCrypto;

  if (!selectedChain) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-950">
        {asset === 'BINANCE_PAY' || asset === 'BYBIT_PAY'
          ? 'This payment method does not use an on-chain linked wallet.'
          : 'Linked wallet debit is available for supported on-chain assets.'}
      </div>
    );
  }

  function selectSource(address: string) {
    setInternalValue(address);
    if (typeof window !== 'undefined') {
      if (address) localStorage.setItem('exspend_wallet_source', address);
      else localStorage.removeItem('exspend_wallet_source');
    }
    onChange?.(address);
  }

  return (
    <section className="rounded-xl border border-green-200 bg-green-50 px-4 py-4">
      <div className="mb-3">
        <p className="text-sm font-semibold text-green-950">Approve from a linked wallet <span className="font-normal text-green-700">(optional)</span></p>
        <p className="mt-1 text-xs text-green-800">
          Choose a verified wallet to use as the source. Exspend only records the source and amount here; your wallet app must still approve/sign the blockchain transaction.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-green-700">Loading all linked wallet balances…</p>
      ) : error ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>
      ) : wallets.length === 0 ? (
        <p className="text-xs text-green-800">
          No linked wallets yet. <a href="/wallets" className="font-semibold underline">Link a wallet</a> or continue with the normal send flow.
        </p>
      ) : (
        <>
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            {wallets.map((wallet) => (
              <div key={wallet.walletId} className="rounded-lg border border-green-100 bg-white px-3 py-2">
                <p className="text-xs font-semibold text-gray-800">{CHAIN_LABELS[wallet.chain]}</p>
                <p className="truncate font-mono text-[11px] text-gray-500" title={wallet.address}>{shortAddress(wallet.address)}</p>
                {wallet.error ? (
                  <p className="mt-1 text-[11px] text-amber-700">Balance unavailable</p>
                ) : wallet.holdings.length > 0 ? (
                  <p className="mt-1 text-[11px] text-gray-600">
                    {wallet.holdings.map((holding) => `${formatAmount(holding.amount)} ${holding.asset}`).join(' · ')}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-gray-500">No supported balance</p>
                )}
              </div>
            ))}
          </div>

          {sourceOptions.length > 0 ? (
            <label className="block text-xs font-semibold text-green-950">
              {selectedAsset} available for this order
              <select
                value={selectedValue}
                onChange={(event) => selectSource(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-green-300 bg-white px-3 py-2 font-normal text-gray-800"
              >
                <option value="">Pay manually / choose later</option>
                {sourceOptions.map(({ wallet, holding }) => (
                  <option key={wallet.walletId} value={wallet.address}>
                    {CHAIN_LABELS[wallet.chain]} · {formatAmount(holding.amount)} {holding.asset} · {shortAddress(wallet.address)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-xs text-green-800">
              No {selectedAsset} balance was found on a linked {CHAIN_LABELS[selectedChain]} wallet. You can link another wallet or continue with the normal send flow.
            </p>
          )}

          {selected && (
            <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${selectedHasEnough ? 'bg-white text-green-900' : 'bg-red-50 text-red-800'}`}>
              <p className="font-semibold">Debit approval preview</p>
              <p className="mt-1">
                {formatAmount(cryptoAmount)} {selected.holding.asset} from {CHAIN_LABELS[selected.wallet.chain]} · approximately GHS {amountGhs.toFixed(2)}
              </p>
              {!selectedHasEnough && (
                <p className="mt-1 font-semibold">This wallet does not have enough of the selected asset for this order.</p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}