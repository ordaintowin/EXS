'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('exspend_token');
}

function getIsAdmin(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('exspend_token');
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.isAdmin === true;
  } catch { return false; }
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getAdminToken()}` };
}

const WALLET_FIELDS = [
  { key: 'USDT_TRC20', label: 'USDT (TRC-20)' },
  { key: 'USDT_BEP20', label: 'USDT (BEP-20)' },
  { key: 'USDT_POLYGON', label: 'USDT (Polygon)' },
  { key: 'USDC_BEP20', label: 'USDC (BEP-20)' },
  { key: 'USDC_POLYGON', label: 'USDC (Polygon)' },
  { key: 'BTC', label: 'Bitcoin (BTC)' },
  { key: 'BNB', label: 'BNB (BEP-20)' },
  { key: 'ETH', label: 'Ethereum (ETH)' },
  { key: 'BINANCE_PAY', label: 'Binance Pay ID' },
  { key: 'BYBIT_PAY', label: 'Bybit Pay ID' },
] as const;

type WalletKey = typeof WALLET_FIELDS[number]['key'];
type WalletData = Record<WalletKey, string>;
type DepositAlertReadiness = {
  signatureSecretConfigured: boolean;
  configuredAddressCount: number;
};

const emptyWallets = (): WalletData =>
  Object.fromEntries(WALLET_FIELDS.map(({ key }) => [key, ''])) as WalletData;

export default function AdminWalletsPage() {
  const router = useRouter();
  const [wallets, setWallets] = useState<WalletData>(emptyWallets());
  const [depositAlerts, setDepositAlerts] = useState<DepositAlertReadiness>({
    signatureSecretConfigured: false,
    configuredAddressCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchWallets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/wallets', { headers: authHeaders() });
      if (!res.ok) throw new Error('Could not load wallet settings.');
      const data = await res.json();
      if (data.wallets) setWallets((prev) => ({ ...prev, ...data.wallets }));
      if (data.depositAlerts) setDepositAlerts(data.depositAlerts);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Could not load wallet settings.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!getIsAdmin()) {
      router.replace('/spend');
      return;
    }
    fetchWallets();
  }, [router, fetchWallets]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/wallets', {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(wallets),
      });

      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error ?? 'Failed to save wallet settings.' });
      } else {
        const data = await res.json();
        if (data.depositAlerts) setDepositAlerts(data.depositAlerts);
        setMessage({ type: 'success', text: 'Wallet addresses saved successfully.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Wallet Settings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Manage wallet addresses shown to users when they buy crypto.
      </p>

      <div className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
        depositAlerts.signatureSecretConfigured && depositAlerts.configuredAddressCount > 0
          ? 'border-blue-200 bg-blue-50 text-blue-950'
          : 'border-amber-200 bg-amber-50 text-amber-950'
      }`}>
        <p className="font-semibold">
          {depositAlerts.signatureSecretConfigured && depositAlerts.configuredAddressCount > 0
            ? 'Webhook prerequisites are configured; provider monitoring still needs to be active'
            : 'Automatic deposit alerts need setup'}
        </p>
        <ul className="mt-2 space-y-1 text-xs">
          <li>
            Signature secret: {depositAlerts.signatureSecretConfigured ? 'configured' : 'missing'}.
            {!depositAlerts.signatureSecretConfigured && ' Add TATUM_HMAC_SECRET in Replit Secrets; never put it in client code or commit it.'}
          </li>
          <li>
            Admin blockchain receive addresses: {depositAlerts.configuredAddressCount} configured.
            {' '}Configure the same addresses and networks in your monitoring provider.
          </li>
          <li>
            Set the provider callback to your app’s public HTTPS endpoint <span className="font-mono">/api/webhooks/tatum</span> and configure its signature to use the same secret.
          </li>
          <li>
            When a valid event arrives, Exspend records it and alerts admins. Enable browser alerts from the admin notification bell; keep manual confirmation before completing orders.
          </li>
        </ul>
        <p className="mt-2 text-xs">
          This checklist reports app-side readiness only; it cannot confirm that the provider is actively monitoring an address. Review the provider dashboard and its current fees.
        </p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading wallet settings…</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {WALLET_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="text"
                value={wallets[key]}
                onChange={(e) =>
                  setWallets((prev) => ({ ...prev, [key]: e.target.value }))
                }
                placeholder={`Enter ${label} address`}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          ))}

          {message && (
            <div
              className={`rounded-lg px-4 py-3 text-sm font-medium ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="bg-green-900 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Wallet Addresses'}
          </button>
        </form>
      )}
    </div>
  );
}
