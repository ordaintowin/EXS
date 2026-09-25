'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/app/lib/auth';

type OrderType = 'spend' | 'buy' | 'sell';
type Order = {
  id: string;
  orderType: OrderType;
  service: string;
  amountGhs: number;
  cryptoAmount: string;
  cryptoAsset: string;
  status: string;
  createdAt: string;
  recipient?: string | null;
  recipientName?: string | null;
};
type Tab = 'all' | 'spending' | 'transfers';

const TAB_LABELS: Record<Tab, string> = { all: 'All activity', spending: 'Spending', transfers: 'Transfers' };
const STATUS_STYLE: Record<string, string> = {
  waiting: 'bg-orange-100 text-orange-800',
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  successful: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function HistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError('Sign in to view your activity.');
      setLoading(false);
      return;
    }
    fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? 'Could not load your activity.');
        setOrders(data.orders ?? []);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Could not load your activity.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => orders.filter((order) => {
    if (tab === 'spending') return order.orderType === 'spend';
    if (tab === 'transfers') return order.orderType === 'buy' || order.orderType === 'sell';
    return true;
  }), [orders, tab]);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-green-700">Account activity</p>
            <h1 className="mt-1 text-3xl font-bold text-green-950">Spending & transfer history</h1>
            <p className="mt-2 text-sm text-gray-600">Review your local-currency spend orders and crypto buy/sell transfers.</p>
          </div>
          <Link href="/wallets" className="text-sm font-semibold text-green-800 underline underline-offset-4">Manage wallets</Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {(Object.keys(TAB_LABELS) as Tab[]).map((key) => (
            <button
              type="button"
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${tab === key ? 'bg-green-800 text-white' : 'border border-gray-300 bg-white text-gray-700'}`}
            >
              {TAB_LABELS[key]}
            </button>
          ))}
        </div>

        <section className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Loading activity…</p>
          ) : error ? (
            <p role="alert" className="p-6 text-sm text-red-700">{error} <Link className="underline" href="/login">Sign in</Link></p>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center">
              <p className="font-semibold text-gray-800">No {tab === 'all' ? 'activity' : tab} found</p>
              <p className="mt-1 text-sm text-gray-500">Completed and pending orders will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`} className="block p-4 transition hover:bg-gray-50 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold capitalize text-green-800">
                          {order.orderType === 'spend' ? 'Spending' : order.orderType === 'buy' ? 'Crypto buy' : 'Crypto sell'}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[order.status] ?? 'bg-gray-100 text-gray-700'}`}>{order.status}</span>
                      </div>
                      <p className="mt-2 truncate font-semibold text-gray-900">{order.service}</p>
                      <p className="mt-1 text-xs text-gray-500">{formatDate(order.createdAt)} · Ref {order.id.slice(0, 8).toUpperCase()}</p>
                      {(order.recipientName || order.recipient) && (
                        <p className="mt-1 truncate text-xs text-gray-500">
                          Recipient: {[order.recipientName, order.recipient].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">GHS {Number(order.amountGhs).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      {order.cryptoAsset && <p className="mt-1 text-xs text-gray-500">{order.cryptoAmount} {order.cryptoAsset}</p>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}