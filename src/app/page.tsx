"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/hooks/use-app-context';
import { Loader2 } from 'lucide-react';
import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants';

export default function HomePage() {
  const router = useRouter();
  const { profile, isLoading } = useAppContext();

  useEffect(() => {
    if (!isLoading) {
      if (profile && profile.startDate && profile.oneRepMaxes.squat > 0) { // Basic check for a configured profile
        router.replace('/dashboard');
      } else {
        router.replace('/profile');
      }
    }
  }, [profile, isLoading, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-6" />
      <h1 className="text-4xl font-bold text-foreground mb-2">{APP_NAME}</h1>
      <p className="text-lg text-muted-foreground mb-8">{APP_DESCRIPTION}</p>
      <p className="text-sm text-muted-foreground">Loading your data...</p>
    </div>
  );
}
