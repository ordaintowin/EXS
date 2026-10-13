'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, LoaderCircle, MailCheck } from 'lucide-react';

type Status = 'checking' | 'ready' | 'success' | 'error';

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const queryEmail = searchParams.get('email') ?? '';
  const deliveryUnavailable = searchParams.get('sent') === '0';
  const [email, setEmail] = useState(queryEmail);
  const [status, setStatus] = useState<Status>(token ? 'checking' : 'ready');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!active) return;
        if (!response.ok) {
          setStatus('error');
          setMessage(data.error ?? 'This verification link is not valid.');
          return;
        }
        setStatus('success');
        setMessage(data.message ?? 'Email verified successfully.');
      })
      .catch(() => {
        if (!active) return;
        setStatus('error');
        setMessage('We could not verify your email. Please request a new link.');
      });
    return () => { active = false; };
  }, [token]);

  async function resendVerification(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      setMessage(response.ok ? data.message : (data.error ?? 'Could not resend the verification email.'));
    } catch {
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-green-400 to-white px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <span className="text-3xl font-bold"><span className="text-lime-400">Ex</span><span className="text-green-900">spend</span></span>
        </div>

        {status === 'checking' ? (
          <div className="py-8 text-center">
            <LoaderCircle className="mx-auto animate-spin text-green-700" size={34} />
            <h1 className="mt-4 text-2xl font-bold text-green-900">Verifying your email…</h1>
          </div>
        ) : status === 'success' ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto text-green-600" size={48} />
            <h1 className="mt-4 text-2xl font-bold text-green-900">Email verified</h1>
            <p className="mt-2 text-sm leading-6 text-green-800">{message}</p>
            <Link href="/login" className="mt-6 inline-flex rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white hover:bg-green-800">Continue to sign in</Link>
          </div>
        ) : (
          <>
            <div className="text-center">
              <MailCheck className="mx-auto text-green-700" size={42} />
              <h1 className="mt-4 text-2xl font-bold text-green-900">Check your inbox</h1>
              <p className="mt-2 text-sm leading-6 text-green-800">
                {deliveryUnavailable
                  ? 'Your account was created, but email delivery is not configured yet. Please contact support to enable verification emails.'
                  : 'We sent a verification link to finish setting up your Exspend account.'}
              </p>
            </div>
            {status === 'error' && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
            <form onSubmit={resendVerification} className="mt-6 space-y-3">
              <label className="block text-sm font-medium text-green-900">Email address</label>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="your@email.com" className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-700 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60">
                {loading ? <><LoaderCircle size={16} className="animate-spin" /> Sending…</> : 'Resend verification email'}
              </button>
            </form>
            {message && status !== 'error' && <p className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</p>}
            <p className="mt-6 text-center text-sm text-green-800"><Link href="/login" className="font-semibold underline">Back to sign in</Link></p>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-green-50 text-green-900">Loading…</div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}