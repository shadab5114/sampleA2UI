import type { Metadata } from 'next';
import * as React from 'react';
import Providers from './providers';

export const metadata: Metadata = {
  title: 'PhoneHub — A2UI + MUI',
  description: 'A2UI protocol demo: deterministic + conversational, one renderer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
