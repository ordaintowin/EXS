import Link from 'next/link';
import {
  ArrowRight,
  Banknote,
  Check,
  CircleHelp,
  LockKeyhole,
  MoveRight,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from 'lucide-react';
import WalletIllustration from '@/app/components/WalletIllustration';

const services = [
  { icon: Smartphone, label: 'Spend crypto', text: 'Turn crypto into airtime, data, MoMo and bank payments.' },
  { icon: Banknote, label: 'Buy crypto', text: 'Purchase popular assets with a clear GHS quote and delivery address.' },
  { icon: MoveRight, label: 'Sell crypto', text: 'Send crypto and receive Ghana cedis through your preferred payout method.' },
];

const principles = [
  'You keep control of your non-custodial wallet',
  'We never ask for a recovery phrase or private key',
  'Every order shows the asset, amount and rate before you confirm',
];

export default function Home() {
  return (
    <main className="-mx-4 -mt-8 overflow-hidden bg-[#f5f8f3] text-slate-900">
      <section className="relative overflow-hidden bg-green-950 px-4 pb-20 pt-14 text-white sm:px-6 sm:pb-28 sm:pt-20">
        <div className="absolute -right-32 -top-36 h-[30rem] w-[30rem] rounded-full bg-lime-300/15 blur-3xl" />
        <div className="absolute -bottom-48 left-[35%] h-[34rem] w-[34rem] rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(rgba(190,242,100,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(190,242,100,0.4) 1px, transparent 1px)', backgroundSize: '54px 54px' }} />

        <div className="relative mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-lime-300/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-lime-200 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-lime-300" />
                Crypto payments, made understandable
              </div>
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
                Move between crypto and Ghana cedis with confidence.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-green-100 sm:text-lg">
                Exspend helps you spend, buy and sell crypto for the things you need in Ghana. Clear rates, familiar payments and wallet education built into the experience.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3.5 text-sm font-bold text-green-950 transition-colors hover:bg-lime-200">
                  Get started <ArrowRight size={17} />
                </Link>
                <Link href="/learn-wallets" className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                  Understand wallets
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-green-200">
                <span className="inline-flex items-center gap-2"><ShieldCheck size={15} className="text-lime-300" /> Non-custodial friendly</span>
                <span className="inline-flex items-center gap-2"><LockKeyhole size={15} className="text-lime-300" /> No seed phrases</span>
              </div>
            </div>
            <WalletIllustration variant="connect" />
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-8 max-w-6xl px-4 sm:px-6">
        <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.1)] sm:grid-cols-3 sm:p-5">
          {services.map(({ icon: Icon, label, text }) => (
            <div key={label} className="flex gap-3 rounded-2xl p-3 transition-colors hover:bg-green-50">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-800"><Icon size={19} /></div>
              <div><h2 className="text-sm font-semibold text-slate-950">{label}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-700">Start with the basics</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Custodial or non-custodial? Know the difference.</h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              A custodial wallet is managed by a platform. A non-custodial wallet is controlled by you. Neither is automatically right or wrong—the important thing is knowing who holds the keys.
            </p>
            <Link href="/learn-wallets" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-green-800 hover:text-green-950">
              Read the wallet guide <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <WalletIllustration variant="custodial" compact />
            <WalletIllustration variant="noncustodial" compact />
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-20 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="order-2 rounded-[2rem] bg-green-950 p-6 text-white shadow-xl sm:p-8 lg:order-1">
            <div className="flex items-center gap-2 text-lime-300"><WalletCards size={18} /><span className="text-xs font-bold uppercase tracking-[0.2em]">A calmer way to transact</span></div>
            <div className="mt-7 space-y-5">
              {principles.map((principle) => (
                <div key={principle} className="flex gap-3 text-sm leading-6 text-green-100">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime-300 text-green-950"><Check size={13} strokeWidth={3} /></span>
                  <span>{principle}</span>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-white/10 pt-5 text-xs leading-5 text-green-200">
              Exspend does not currently hold crypto in an in-app wallet. Linked wallets remain external wallets you control.
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-700">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Clear from the first click to the final confirmation.</h2>
            <div className="mt-7 space-y-5">
              {[
                ['01', 'Choose a service', 'Spend, buy or sell using the flow that matches your goal.'],
                ['02', 'Review the quote', 'See the crypto amount, GHS value and destination before continuing.'],
                ['03', 'Confirm with your wallet', 'Use your external wallet or destination address and keep control of the final transaction.'],
              ].map(([number, title, text]) => (
                <div key={number} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-100 text-xs font-bold text-green-800">{number}</span>
                  <div><h3 className="font-semibold text-slate-950">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="rounded-[2rem] bg-gradient-to-br from-lime-200 via-lime-100 to-white p-7 sm:p-10">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <div className="flex items-center gap-2 text-green-800"><CircleHelp size={18} /><span className="text-xs font-bold uppercase tracking-[0.2em]">New to crypto?</span></div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-green-950 sm:text-3xl">Learn first. Move with confidence.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-green-900/70">Our wallet guide explains custody, connection, signatures and the safety checks that protect your account.</p>
            </div>
            <Link href="/learn-wallets" className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-green-800">
              Explore the guide <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-green-950 px-4 py-10 text-green-200 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-semibold text-white">Exspend</p><p className="mt-1 text-xs text-green-300/70">Crypto-to-GHS services for everyday life in Ghana.</p></div>
          <div className="flex flex-wrap gap-5 text-xs font-medium"><Link href="/learn-wallets" className="hover:text-lime-300">Wallet guide</Link><Link href="/policies" className="hover:text-lime-300">Policies</Link><a href="https://wa.me/233571827900" target="_blank" rel="noopener noreferrer" className="hover:text-lime-300">WhatsApp support</a></div>
        </div>
      </footer>
    </main>
  );
}