import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'PAINAWA Resort & Stay | Find Your Place to Pause', template: '%s | PAINAWA Resort & Stay' },
  description: 'A tropical resort escape in the Philippines. Explore thoughtful villas, poolside suites and cottages, and request your stay at PAINAWA Resort & Stay.',
  keywords: ['Philippines resort', 'tropical resort', 'villa booking', 'PAINAWA', 'resort stay'],
  openGraph: { title: 'PAINAWA Resort & Stay', description: 'Where the world slows down. Your tropical escape in the Philippines.', images: ['https://images.pexels.com/photos/27429704/pexels-photo-27429704.jpeg?auto=compress&cs=tinysrgb&w=1200'] },
};
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
