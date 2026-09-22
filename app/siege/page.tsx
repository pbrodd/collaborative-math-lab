import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { applicationOrigin } from '../../lib/origin';
import { SiegePreview } from '../components/SiegePreview';

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  const origin = applicationOrigin(
    `${host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'}://${host}`,
  );
  const title = 'Every second counts · Tactical rehearsal';
  const description =
    'Your team. Your plan. Decode the mission intel and coordinate your arrival in a playable algebra adventure.';
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: `${origin}/siege-briefing-og.png`,
          alt: 'Every second counts. A luminous relay device above a tactical command table.',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${origin}/siege-briefing-og.png`],
    },
  };
}

export default function SiegePage() {
  return <SiegePreview />;
}
