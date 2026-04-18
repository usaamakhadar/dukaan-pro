import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";

const inter = Inter({ subsets: ["latin"] });

import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Dukaan Pro | Premium Retail",
  description: "Advanced Multi-tenant Point of Sale system.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Dukaan Pro",
    statusBarStyle: "black-translucent",
  }
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b132b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-[100dvh] bg-white text-zinc-900 antialiased`}>
        <LanguageProvider>
          {children}
          <Toaster />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js');
                  });
                }
              `,
            }}
          />
        </LanguageProvider>
      </body>
    </html>
  );
}
