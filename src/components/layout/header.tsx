import React from 'react';
import { Breadcrumbs } from '../breadcrumbs';
import SearchInput from '../search-input';
import { UserNav } from './user-nav';
import { ThemeSelector } from '../theme-selector';
import { ModeToggle } from './ThemeToggle/theme-toggle';
import CtaGithub from './cta-github';

export default function Header() {
  return (
    <header
      className='border-border/40 bg-background/90 sticky top-0 z-40 flex min-h-16 items-center gap-3 border-b px-4 backdrop-blur'
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        minHeight: 'calc(64px + env(safe-area-inset-top, 0px))'
      }}
    >
      <div className='min-w-0 flex-1'>
        <Breadcrumbs />
      </div>

      <div className='flex items-center gap-2'>
        <CtaGithub />
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
