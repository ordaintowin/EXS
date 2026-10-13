'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getCurrentUser } from '@/app/lib/auth';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/policies', '/learn-wallets', '/logout'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);

  useEffect(() => {
    // Auth is stored in browser storage, so it must be read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(getCurrentUser());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, [pathname]);

  const isPublic = useMemo(
    () => PUBLIC_PATHS.some((p) => pathname === p),
    [pathname],
  );

  useEffect(() => {
    if (mounted && !user && !isPublic) {
      router.replace('/login');
    }
  }, [mounted, user, isPublic, router]);

  if (!mounted) {
    return null;
  }

  if (!user && !isPublic) {
    return null;
  }

  return <>{children}</>;
}
