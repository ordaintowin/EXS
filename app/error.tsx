'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f8f3] px-6 py-16">
      <div className="max-w-md rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-red-700">Something went wrong</p>
        <h1 className="mt-2 text-2xl font-bold text-green-950">This page could not load</h1>
        <p className="mt-3 text-sm text-slate-600">Please try again. Your account and orders have not been changed.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 rounded-xl bg-green-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-900"
        >
          Try again
        </button>
      </div>
    </main>
  );
}