'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { registerUser, getCurrentUser, getToken } from '@/app/lib/auth';

type WalletSetup = 'metamask' | 'trust' | 'other' | 'create' | 'later';

const WALLET_SETUP_OPTIONS: { value: WalletSetup; title: string; description: string }[] = [
  { value: 'metamask', title: 'MetaMask', description: 'I already use MetaMask' },
  { value: 'trust', title: 'Trust Wallet', description: 'I already use Trust Wallet' },
  { value: 'other', title: 'Another wallet', description: 'I use a different compatible wallet' },
  { value: 'create', title: 'I need a wallet', description: 'Show me how to create one safely' },
  { value: 'later', title: 'Skip for now', description: 'I’ll connect a wallet later' },
];

export default function SignupPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [walletSetup, setWalletSetup] = useState<WalletSetup>('later');
  const [referralCode, setReferralCode] = useState('');
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referralChecking, setReferralChecking] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (user && getToken()) {
      router.replace('/spend');
    } else {
      setMounted(true);
    }
  }, [router]);

  if (!mounted) return null;

  async function checkReferralCode(code: string) {
    if (!code.trim()) {
      setReferralValid(null);
      return;
    }
    setReferralChecking(true);
    try {
      const res = await fetch('/api/referral/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      setReferralValid(data.valid === true);
    } catch {
      setReferralValid(null);
    } finally {
      setReferralChecking(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    // If referral code entered but not yet validated, validate it now
    if (referralCode.trim() && referralValid === null) {
      await checkReferralCode(referralCode);
      // Re-check after validation completes
      setLoading(false);
      setError('Please wait for referral code validation to complete, then try again.');
      return;
    }
    if (referralCode.trim() && referralValid === false) {
      setLoading(false);
      setError('Invalid referral code. Please remove it or enter a valid code.');
      return;
    }

    const result = await registerUser(name, email, phone, password, referralCode.trim() || undefined);
    setLoading(false);

    if (result.success) {
      if (walletSetup === 'later') {
        router.push('/spend');
      } else if (walletSetup === 'create') {
        router.push('/wallets?setup=create');
      } else {
        router.push(`/wallets?wallet=${walletSetup}`);
      }
    } else {
      setError(result.error ?? 'Registration failed.');
    }
  }

  return (
    <div className="bg-gradient-to-b from-green-400 to-white min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <span className="text-3xl font-bold">
             <span className="text-lime-400">Ex</span>
            <span className="text-green-900">spend</span>
          </span>
        </div>

        <h1 className="text-green-900 font-bold text-2xl mb-1 text-center">Create your account</h1>
        <p className="text-green-700 text-sm text-center mb-6">Join Exspend — pay local with crypto</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-green-900 text-sm font-medium mb-1">Full Name</label>
            <input
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-green-900 text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-green-900 text-sm font-medium mb-1">Phone Number</label>
            <input
              type="text"
              placeholder="e.g. 0241234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={10}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-green-900 text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-green-900 text-sm font-medium mb-1">Confirm Password</label>
            <input
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-green-900 text-sm font-medium mb-1">
              Referral Code <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. EXP-ABC123DEF456"
                value={referralCode}
                onChange={(e) => {
                  setReferralCode(e.target.value);
                  setReferralValid(null);
                }}
                onBlur={() => checkReferralCode(referralCode)}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${
                  referralValid === true ? 'border-green-400' : referralValid === false ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {referralChecking && (
                <span className="absolute right-3 top-3 text-xs text-gray-400">Checking…</span>
              )}
              {referralValid === true && !referralChecking && (
                <span className="absolute right-3 top-3 text-xs text-green-600 font-medium">✓ Valid</span>
              )}
              {referralValid === false && !referralChecking && (
                <span className="absolute right-3 top-3 text-xs text-red-600 font-medium">✗ Invalid</span>
              )}
            </div>
            {referralValid === true && (
              <p className="text-xs text-green-600 mt-1">Referral code applied! Your friend will earn 200 MB when you get verified.</p>
            )}
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-green-900">Choose your wallet setup <span className="font-normal text-green-600">(optional)</span></legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {WALLET_SETUP_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm transition-colors ${
                    walletSetup === option.value
                      ? 'border-green-700 bg-green-50 ring-1 ring-green-700'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="walletSetup"
                    value={option.value}
                    checked={walletSetup === option.value}
                    onChange={() => setWalletSetup(option.value)}
                    className="mt-1 accent-green-700"
                  />
                  <span>
                    <span className="block font-semibold text-green-900">{option.title}</span>
                    <span className="mt-0.5 block text-xs text-gray-600">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-green-700">
              Wallets are created in their official app, not from your Exspend account details. Exspend never asks for a recovery phrase or private key.
            </p>
          </fieldset>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 hover:bg-green-800 text-white rounded-xl py-3 font-semibold transition-colors disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create Account →'}
          </button>
        </form>

        <p className="text-center text-sm text-green-800 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

