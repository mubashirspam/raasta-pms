import { redirect } from 'next/navigation';

// Root redirect → public targets page
export default function HomePage() {
  redirect('/targets');
}
