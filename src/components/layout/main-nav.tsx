'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard/overview', label: 'Record' },
  { href: '/dashboard/journals', label: 'Journals' },
  { href: '/dashboard/echos', label: 'Echos' }
];

export default function MainNav() {
  const pathname = usePathname();

  return (
    <nav className='hidden items-center gap-1 lg:flex'>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-secondary text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
