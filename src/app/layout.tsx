import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { Providers } from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RAASTA Tracker — Team Najeeb',
  description: 'Performance tracking for Team Najeeb Sales Agents and Content Creators',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F7F7F5',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: '#FFFFFF',
                color: '#17171A',
                border: '1px solid #E3E3DE',
                boxShadow: '0 8px 28px rgba(23,23,26,0.12)',
              },
              success: {
                iconTheme: { primary: '#12894C', secondary: '#FFFFFF' },
              },
              error: {
                iconTheme: { primary: '#C4372F', secondary: '#FFFFFF' },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
