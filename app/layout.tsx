import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { applicationOrigin } from '../lib/origin';
import './globals.css';
import './siege.css';
import 'mathlive/fonts.css';
import 'mathlive/static.css';

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  const origin = applicationOrigin(
    `${host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'}://${host}`,
  );
  return {
    title: 'Untitled · A student discovery lab',
    description:
      'Your questions. Your team. Your math. Create, remix, solve, and peer-review collaborative algebra adventures.',
    openGraph: {
      title: 'Your questions. Your team. Your math.',
      description: 'A student-owned discovery lab. Create, remix, solve, and review together.',
      images: [
        {
          url: `${origin}/og.png`,
          alt: 'Your questions. Your team. Your math. A student discovery lab.',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Your questions. Your team. Your math.',
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
