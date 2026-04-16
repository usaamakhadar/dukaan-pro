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
  themeColor: "#0b132b",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  appleWebApp: {
    capable: true,
    title: "Dukaan Pro",
    statusBarStyle: "black-translucent",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-white text-zinc-900 antialiased`}>
        <LanguageProvider>
          {children}
          <Toaster />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').then(function(registration) {
                      console.log('SW registered: ', registration);
                    }, function(err) {
                      console.log('SW registration failed: ', err);
                    });
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
