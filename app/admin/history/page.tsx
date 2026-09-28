'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type OrderRecord = {
  id: string;
  orderType: string;
  service: string;
  status: string;
  amountGhs: number;
  cryptoAsset: string;
  cryptoAmount: string;
  userWalletAddress?: string | null;
  createdAt: string;
  user: { name: string; email: string };
};

type DepositRecord = {
  id: string;
  chain: string;
  txHash: string;
  destination: string;
  sourceAddress?: string | null;
  asset: string;
  amount: string;
  status: string;
  createdAt: string;
};

type ActivityFilter = 'all' | 'orders' | 'deposits';

function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('exspend_token');
}

function isAdmin(): boolean {
  const token = getAdminToken();
  if (!token) return false;
  try {
    return JSON.parse(atob(token.split('.')[1])).isAdmin === true;
  } catch {
    return false;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function shorten(value?: string | null) {
  if (!value) return '—';
  return value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
}

export default function AdminHistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin()) {
      router.replace('/spend');
      return;
    }

    const token = getAdminToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch('/api/admin/orders', { headers }),
      fetch('/api/admin/deposits', { headers }),
    ])
      .then(async ([ordersResponse, depositsResponse]) => {
        if (!ordersResponse.ok || !depositsResponse.ok) {
          throw new Error('Could not load activity history.');
        }
        const [ordersData, depositsData] = await Promise.all([
          ordersResponse.json(),
          depositsResponse.json(),
        ]);
        setOrders(ordersData.orders ?? []);
        setDeposits(depositsData.deposits ?? []);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Could not load activity history.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const activity = useMemo(() => {
    const orderItems = filter === 'deposits' ? [] : orders.map((order) => ({
      kind: 'order' as const,
      id: order.id,
      createdAt: order.createdAt,
      order,
    }));
    const depositItems = filter === 'orders' ? [] : deposits.map((deposit) => ({
      kind: 'deposit' as const,
      id: deposit.id,
      createdAt: deposit.createdAt,
      deposit,
    }));
    return [...orderItems, ...depositItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [deposits, filter, orders]);

  const filterButtons: { value: ActivityFilter; label: string }[] = [
    { value: 'all', label: 'All activity' },
    { value: 'orders', label: 'Customer orders' },
    { value: 'deposits', label: 'Detected transfers' },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Activity History</h1>
        <p className="mt-1 text-sm text-gray-500">
          Customer spending, buy/sell orders, and blockchain transfers detected by the webhook.
        </p>
      </div>

      <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Detected blockchain transfers are unverified activity records. Review confirmations and order details manually; they do not mark orders paid automatically.
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {filterButtons.map((button) => (
          <button
            key={button.value}
            type="button"
            onClick={() => setFilter(button.value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              filter === button.value
                ? 'bg-green-800 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {button.label}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-[900px] w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Activity</th>
              <th className="px-4 py-3">Customer / Network</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Address / Transaction</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">Loading activity…</td></tr>
            ) : activity.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No activity found.</td></tr>
            ) : activity.map((item) => item.kind === 'order' ? (
              <tr key={`order-${item.id}`} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(item.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className="font-semibold capitalize text-gray-800">{item.order.orderType}</span>
                  <span className="block text-xs text-gray-500">{item.order.service}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-gray-800">{item.order.user.name}</span>
                  <span className="block text-xs text-gray-500">{item.order.user.email}</span>
                </td>
                <td className="px-4 py-3 text-gray-800">
                  GHS {Number(item.order.amountGhs).toFixed(2)}
                  <span className="block text-xs text-gray-500">{item.order.cryptoAmount} {item.order.cryptoAsset}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600" title={item.order.userWalletAddress ?? ''}>
                  {shorten(item.order.userWalletAddress)}
                </td>
                <td className="px-4 py-3 capitalize text-gray-700">{item.order.status}</td>
              </tr>
            ) : (
              <tr key={`deposit-${item.id}`} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(item.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-gray-800">Detected transfer</span>
                  <span className="block text-xs capitalize text-gray-500">{item.deposit.chain}</span>
                </td>
                <td className="px-4 py-3 text-gray-800">{item.deposit.asset}</td>
                <td className="px-4 py-3 text-gray-800">{item.deposit.amount} {item.deposit.asset}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-600" title={item.deposit.txHash}>
                  <span className="block">To: {shorten(item.deposit.destination)}</span>
                  <span className="block">Tx: {shorten(item.deposit.txHash)}</span>
                </td>
                <td className="px-4 py-3 capitalize text-amber-700">{item.deposit.status} — review required</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}