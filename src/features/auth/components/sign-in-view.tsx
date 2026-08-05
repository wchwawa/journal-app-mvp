import { SignIn as ClerkSignInForm } from '@clerk/nextjs';
import { Mic } from 'lucide-react';
import Link from 'next/link';

export default function SignInViewPage() {
  return (
    <div className='relative h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
      <div className='relative hidden h-full flex-col p-10 text-[#e7eef4] lg:flex'>
        <div className='absolute inset-0 bg-[#0a121a]' />
        <div className='relative z-20 flex items-center gap-2 text-lg font-medium'>
          <Mic className='h-5 w-5' />
          <span className='font-serif font-semibold tracking-tight'>
            EchoJournal
          </span>
          <span className='mt-[-6px] ml-[-2px] inline-block h-2 w-2 rounded-full bg-[#29c7e8]' />
        </div>
        <div className='relative z-20 mt-auto'>
          <blockquote className='space-y-3'>
            <p className='font-serif text-2xl leading-snug'>
              &ldquo;Some days you have the most to say and the least patience
              to type. So don&apos;t type, talk.&rdquo;
            </p>
            <footer className='text-sm text-[#8fa1ac]'>
              Voice-first journaling for effortless self-reflection
            </footer>
          </blockquote>
        </div>
      </div>
      <div className='flex h-full items-center justify-center p-4 lg:p-8'>
        <div className='flex w-full max-w-md flex-col items-center justify-center space-y-6'>
          <ClerkSignInForm />

          <p className='text-muted-foreground px-8 text-center text-sm'>
            By clicking continue, you agree to our{' '}
            <Link
              href='/terms'
              className='hover:text-primary underline underline-offset-4'
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              href='/privacy'
              className='hover:text-primary underline underline-offset-4'
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
