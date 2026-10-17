import type { Metadata } from 'next';
import './globals.css';
import './theme.css';

export const metadata: Metadata = {
  title: 'Fieldnote | Farm Planner',
  description:
    'A thoughtful field planner for plots, planting schedules, and harvest records.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
