import { Dumbbell } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

export function AppLogo() {
  return (
    <div className="flex items-center gap-2 p-2">
      <Dumbbell className="h-8 w-8 text-primary" />
      <h1 className="text-xl font-bold text-foreground">{APP_NAME}</h1>
    </div>
  );
}
