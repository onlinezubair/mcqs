import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MCQ Projector',
  description: 'Offline-first timed MCQ exam projector for classrooms',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#1e1e1e',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/manifest.webmanifest`} />
        <link rel="icon" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/icon.svg`} type="image/svg+xml" />
        <link rel="apple-touch-icon" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/icon.svg`} />
        <meta name="theme-color" content="#1e1e1e" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MCQ Projector" />
      </head>
      <body>{children}</body>
    </html>
  );
}