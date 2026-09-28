import Link from 'next/link';
import { ArrowRight, Check, CircleAlert, KeyRound, ShieldCheck, Smartphone, WalletCards } from 'lucide-react';
import WalletIllustration from '@/app/components/WalletIllustration';

const steps = [
  {
    number: '01',
    title: 'Choose your wallet app',
    text: 'MetaMask, Trust Wallet, TronLink and UniSat each support different networks. Pick the app that matches the asset you want to use.',
  },
  {
    number: '02',
    title: 'Open Exspend inside the app',
    text: 'On mobile, use the wallet app’s built-in browser. On desktop, use the official browser extension. This is how your wallet can safely connect.',
  },
  {
    number: '03',
    title: 'Sign an ownership message',
    text: 'Exspend asks for a one-time signature to confirm that you control the public address. It cannot move funds or approve a payment.',
  },
];

export default function LearnWalletsPage() {
  return (
    <main className="-mx-4 -mt-8 min-h-screen bg-[#f5f8f3] text-slate-900">
      <section className="relative overflow-hidden bg-green-950 px-4 pb-16 pt-12 text-white sm:px-6 sm:pb-20 sm:pt-16">
        <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-lime-300/15 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-lime-200 transition-colors hover:text-white">
            ← Back to Exspend
          </Link>
          <div className="grid items-end gap-10 lg:grid-cols-[1fr_0.86fr]">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-lime-300">Wallet basics, without the jargon</p>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
                Know who holds the keys before you move crypto.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-green-100 sm:text-lg">
                A wallet is more than an address. Learn the difference between custodial and non-custodial wallets, then connect yours to Exspend with confidence.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/wallets" className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-green-950 transition-colors hover:bg-lime-200">
                  Connect a wallet <ArrowRight size={16} />
                </Link>
                <Link href="/signup" className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                  Create an account
                </Link>
              </div>
            </div>
            <WalletIllustration variant="connect" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-700">Two wallet models</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">The important difference is control.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">Both models can be useful. The right choice depends on how much responsibility and control you want.</p>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <WalletIllustration variant="custodial" compact />
            <div className="mt-6 flex items-center gap-3">
              <div className="rounded-xl bg-amber-100 p-2.5 text-amber-700"><ShieldCheck size={20} /></div>
              <div>
                <h3 className="text-xl font-semibold text-slate-950">Custodial wallets</h3>
                <p className="text-sm text-slate-500">A platform holds the private keys for you.</p>
              </div>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              <li className="flex gap-3"><Check className="mt-1 shrink-0 text-amber-600" size={16} /> Easier recovery if you lose access to your password.</li>
              <li className="flex gap-3"><Check className="mt-1 shrink-0 text-amber-600" size={16} /> Convenient for beginners and frequent trading.</li>
              <li className="flex gap-3"><Check className="mt-1 shrink-0 text-amber-600" size={16} /> You rely on the provider to protect and release your assets.</li>
            </ul>
          </div>
          <div className="rounded-[2rem] border border-green-200 bg-green-50/70 p-5 shadow-sm sm:p-7">
            <WalletIllustration variant="noncustodial" compact />
            <div className="mt-6 flex items-center gap-3">
              <div className="rounded-xl bg-green-200 p-2.5 text-green-800"><KeyRound size={20} /></div>
              <div>
                <h3 className="text-xl font-semibold text-green-950">Non-custodial wallets</h3>
                <p className="text-sm text-green-800/70">You hold the private keys and approve actions.</p>
              </div>
            </div>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-green-950/70">
              <li className="flex gap-3"><Check className="mt-1 shrink-0 text-green-700" size={16} /> You keep direct control of your assets.</li>
              <li className="flex gap-3"><Check className="mt-1 shrink-0 text-green-700" size={16} /> Connect from the official wallet app or browser extension.</li>
              <li className="flex gap-3"><Check className="mt-1 shrink-0 text-green-700" size={16} /> Your recovery phrase is your responsibility. Never share it.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-700">Connect in three steps</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">A clear path from wallet to order.</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">Exspend only verifies that the public address belongs to you. It never asks for your recovery phrase or private key.</p>
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <div className="flex gap-3"><CircleAlert className="mt-0.5 shrink-0 text-amber-700" size={18} /><span>Never approve a transaction to link a wallet. Linking uses a message signature only.</span></div>
              </div>
            </div>
            <div className="space-y-4">
              {steps.map((step) => (
                <div key={step.number} className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-900 text-xs font-bold text-lime-300">{step.number}</span>
                  <div>
                    <h3 className="font-semibold text-slate-950">{step.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="rounded-[2rem] bg-green-900 p-7 text-white sm:p-10">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <div className="flex items-center gap-2 text-lime-300"><WalletCards size={18} /><span className="text-xs font-bold uppercase tracking-[0.2em]">Ready when you are</span></div>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Connect a wallet or start with an external address.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-green-100">You can link multiple wallets, view public balances, and choose a destination when buying crypto.</p>
            </div>
            <Link href="/wallets" className="inline-flex items-center justify-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-green-950 hover:bg-lime-200">
              Open wallet settings <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <div className="h-10" />
    </main>
  );
}