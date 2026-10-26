import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CrashTest | Adversarial Resilience Harness for PayPal',
  description: 'Crash-test your PayPal integration or autonomous payment agent before real money does.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#090D16] text-slate-100 selection:bg-cyan-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
