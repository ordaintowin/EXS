import { LockKeyhole, Smartphone, WalletCards } from 'lucide-react';

type WalletIllustrationVariant = 'custodial' | 'noncustodial' | 'connect';

type Props = {
  variant: WalletIllustrationVariant;
  compact?: boolean;
};

const COPY: Record<WalletIllustrationVariant, { eyebrow: string; title: string }> = {
  custodial: { eyebrow: 'Hosted wallet', title: 'A trusted platform holds the keys' },
  noncustodial: { eyebrow: 'Self-custody', title: 'You hold the keys and approve every move' },
  connect: { eyebrow: 'Connect safely', title: 'Pair your wallet in a few clear steps' },
};

export default function WalletIllustration({ variant, compact = false }: Props) {
  return (
    <div className={`overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.12)] ${compact ? 'p-3' : 'p-5'}`}>
      <div className="relative aspect-[1.55] overflow-hidden rounded-2xl bg-gradient-to-br from-green-950 via-green-900 to-emerald-700">
        <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-lime-300/20 blur-2xl" />
        <div className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-emerald-300/20 blur-2xl" />

        {variant === 'custodial' && (
          <svg viewBox="0 0 360 230" className="relative h-full w-full" aria-hidden="true">
            <rect x="34" y="55" width="112" height="126" rx="18" fill="#f7fee7" opacity="0.98" />
            <rect x="52" y="78" width="76" height="9" rx="4" fill="#166534" opacity="0.7" />
            <rect x="52" y="100" width="57" height="9" rx="4" fill="#84cc16" opacity="0.8" />
            <rect x="52" y="132" width="76" height="28" rx="10" fill="#dcfce7" />
            <circle cx="74" cy="146" r="7" fill="#16a34a" />
            <path d="M205 74h78a16 16 0 0 1 16 16v70a16 16 0 0 1-16 16h-78a16 16 0 0 1-16-16V90a16 16 0 0 1 16-16Z" fill="#ecfccb" />
            <path d="M211 109h66M211 127h45M211 145h53" stroke="#166534" strokeWidth="8" strokeLinecap="round" opacity="0.7" />
            <path d="M151 118h34" stroke="#bef264" strokeWidth="5" strokeDasharray="7 7" />
            <path d="m174 108 14 10-14 10" fill="none" stroke="#bef264" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="242" cy="47" r="19" fill="#bef264" />
            <path d="M234 47h16M242 39v16" stroke="#365314" strokeWidth="4" strokeLinecap="round" />
          </svg>
        )}

        {variant === 'noncustodial' && (
          <svg viewBox="0 0 360 230" className="relative h-full w-full" aria-hidden="true">
            <rect x="115" y="32" width="130" height="170" rx="24" fill="#f7fee7" />
            <rect x="129" y="49" width="102" height="130" rx="15" fill="#dcfce7" />
            <circle cx="180" cy="96" r="23" fill="#84cc16" />
            <path d="M172 96h16M180 88v16" stroke="#365314" strokeWidth="5" strokeLinecap="round" />
            <rect x="150" y="140" width="60" height="9" rx="4" fill="#166534" opacity="0.65" />
            <path d="M72 66 38 96l34 30M288 66l34 30-34 30" fill="none" stroke="#bef264" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M88 160h60M212 160h60" stroke="#bef264" strokeWidth="5" strokeDasharray="5 8" />
            <circle cx="65" cy="183" r="13" fill="#bef264" opacity="0.85" />
            <circle cx="295" cy="183" r="13" fill="#bef264" opacity="0.85" />
          </svg>
        )}

        {variant === 'connect' && (
          <svg viewBox="0 0 360 230" className="relative h-full w-full" aria-hidden="true">
            <rect x="44" y="36" width="106" height="158" rx="19" fill="#f7fee7" />
            <rect x="56" y="51" width="82" height="105" rx="10" fill="#dcfce7" />
            <rect x="72" y="72" width="50" height="9" rx="4" fill="#166534" opacity="0.7" />
            <rect x="72" y="96" width="37" height="9" rx="4" fill="#84cc16" />
            <rect x="72" y="123" width="50" height="18" rx="9" fill="#166534" />
            <path d="M177 114h34" stroke="#bef264" strokeWidth="6" strokeLinecap="round" />
            <path d="m204 102 14 12-14 12" fill="none" stroke="#bef264" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="238" y="66" width="77" height="96" rx="18" fill="#ecfccb" />
            <path d="M258 108h37M276 90v36" stroke="#166534" strokeWidth="8" strokeLinecap="round" />
            <circle cx="276" cy="48" r="16" fill="#bef264" />
            <path d="m268 48 6 6 11-13" fill="none" stroke="#365314" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}

        <div className="absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-lime-100 backdrop-blur-md">
          {variant === 'custodial' ? <LockKeyhole size={13} /> : variant === 'noncustodial' ? <WalletCards size={13} /> : <Smartphone size={13} />}
          {COPY[variant].eyebrow}
        </div>
      </div>
      <p className="mt-4 text-sm font-semibold leading-5 text-slate-900">{COPY[variant].title}</p>
    </div>
  );
}