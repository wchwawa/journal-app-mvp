import React from 'react';
import Link from 'next/link';
import { Mic } from 'lucide-react';
import MainNav from './main-nav';
import SearchInput from '../search-input';
import { UserNav } from './user-nav';
import { ThemeSelector } from '../theme-selector';
import { ModeToggle } from './ThemeToggle/theme-toggle';

export default function Header() {
  return (
    <header
      className='border-border/60 bg-background/90 sticky top-0 z-40 flex min-h-16 items-center gap-4 border-b px-4 backdrop-blur lg:px-8'
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        minHeight: 'calc(64px + env(safe-area-inset-top, 0px))'
      }}
    >
      <Link
        href='/dashboard/overview'
        className='text-foreground flex items-center gap-2'
      >
        <span className='bg-foreground text-background flex h-7 w-7 items-center justify-center rounded-lg'>
          <Mic className='h-3.5 w-3.5' />
        </span>
        <span className='font-serif text-lg font-semibold tracking-tight'>
          EchoJournal
        </span>
      </Link>

      <MainNav />

      <div className='min-w-0 flex-1' />

      <div className='flex items-center gap-2'>
        <div className='hidden md:flex'>
          <SearchInput />
        </div>
        <UserNav />
        <ModeToggle />
        <ThemeSelector />
      </div>
    </header>
  );
}
