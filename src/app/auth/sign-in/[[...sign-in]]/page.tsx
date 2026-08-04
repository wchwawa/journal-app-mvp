import { Metadata } from 'next';
import SignInViewPage from '@/features/auth/components/sign-in-view';

export const metadata: Metadata = {
  title: 'Sign In | EchoJournal',
  description: 'Sign in to your EchoJournal account.'
};

export default function Page() {
  return <SignInViewPage />;
}
