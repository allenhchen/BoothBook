import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BoothBook',
  description: 'Artist alley catalog, checkout pools, and convention sales.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('boothbook-theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch{}",
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
