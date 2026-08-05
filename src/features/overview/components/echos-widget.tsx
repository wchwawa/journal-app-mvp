'use client';

import Link from 'next/link';
import { NotebookText } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export default function EchosWidget() {
  return (
    <Link href='/dashboard/echos' className='group relative block h-full'>
      {/* Rainbow gradient border - sharp and condensed */}
      <motion.div
        className='pointer-events-none absolute inset-0 z-0 rounded-2xl opacity-0 blur-[3px] transition-opacity duration-500 group-hover:opacity-100'
        style={{
          background:
            'linear-gradient(90deg, #06657e 0%, #0090b6 40%, #29c7e8 70%, #7fdcef 100%)',
          backgroundSize: '200% 100%',
          padding: '1px',
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude'
        }}
        animate={{
          backgroundPosition: ['0% 50%', '200% 50%', '0% 50%']
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'linear'
        }}
      />

      {/* Condensed rainbow glow - colorful and focused */}
      <motion.div
        className='pointer-events-none absolute -inset-[3px] z-0 rounded-2xl opacity-0 blur-[5px] transition-opacity duration-500 group-hover:opacity-70'
        style={{
          background:
            'linear-gradient(135deg, #06657e 0%, #0090b6 50%, #29c7e8 100%)',
          backgroundSize: '200% 200%'
        }}
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%', '0% 0%']
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />

      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'border-border/20 bg-card/90 relative z-10 flex h-full items-center gap-3 rounded-2xl border px-4 py-3.5 backdrop-blur-sm transition-all duration-300',
          'shadow-sm hover:shadow-md',
          'focus-visible:ring-primary/40 focus-visible:ring-2 focus-visible:outline-none'
        )}
        role='button'
        aria-label='Open echos reflections'
      >
        {/* Icon with gradient background */}
        <motion.div
          className='relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full'
          style={{
            background: 'linear-gradient(135deg, #0090b6 0%, #29c7e8 100%)'
          }}
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          <NotebookText className='h-5 w-5 text-white drop-shadow-sm' />
        </motion.div>

        {/* Text with gradient on hover */}
        <div className='flex flex-1 flex-col'>
          <motion.span
            className='from-foreground to-foreground bg-gradient-to-r bg-clip-text text-base font-semibold transition-all duration-300 group-hover:from-[#0090b6] group-hover:to-[#29c7e8] group-hover:text-transparent'
            initial={false}
          >
            Echos
          </motion.span>
          <span className='text-muted-foreground/70 hidden text-[10px] font-medium sm:inline'>
            AI Reflections
          </span>
        </div>

        {/* Animated arrow indicator */}
        <motion.svg
          className='text-muted-foreground/50 group-hover:text-primary h-4 w-4 shrink-0 transition-colors'
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
          animate={{ x: [0, 4, 0] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M9 5l7 7-7 7'
          />
        </motion.svg>
      </motion.div>
    </Link>
  );
}
