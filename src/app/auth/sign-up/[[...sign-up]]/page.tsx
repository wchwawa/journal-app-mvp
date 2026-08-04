import { Metadata } from 'next';
import SignUpViewPage from '@/features/auth/components/sign-up-view';

export const metadata: Metadata = {
  title: 'Sign Up | EchoJournal',
  description: 'Create your EchoJournal account.'
};

export default function Page() {
  return <SignUpViewPage />;
}
