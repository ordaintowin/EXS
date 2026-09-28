import './globals.css';
import NavBar from './components/NavBar';
import AuthGuard from './components/AuthGuard';

export const metadata = {
  title: 'Exspend — Crypto made clearer',
  description: 'Spend, buy and sell crypto in Ghana with clear rates and wallet-first guidance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f5f8f3] text-slate-900 antialiased" suppressHydrationWarning>
        <AuthGuard>
          <NavBar />
          <main className="max-w-6xl mx-auto mt-8 px-4">{children}</main>
        </AuthGuard>
      </body>
    </html>
  );
}