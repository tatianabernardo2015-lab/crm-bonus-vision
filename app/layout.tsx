import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'CRM Bonus Vision',
    template: '%s · CRM Bonus Vision',
  },
  description: 'CRM de cashback e retenção para óticas e clínicas oftalmológicas.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
