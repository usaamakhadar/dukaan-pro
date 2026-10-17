// Using standard system fonts instead of next/font/google to support restricted build environments
const interFontFamily = "ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'";

import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";

import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Dukaan Pro | Premium Retail",
  description: "Advanced Multi-tenant Point of Sale system.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    shortcut: "/icons/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
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
  minimumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b132b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="overflow-x-hidden">
      <body style={{ fontFamily: interFontFamily }} className="min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-white text-zinc-900 antialiased overscroll-none select-none">
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
                
                // Prevent iOS Safari pinch-to-zoom
                document.addEventListener('gesturestart', function(e) {
                  e.preventDefault();
                });
                document.addEventListener('gesturechange', function(e) {
                  e.preventDefault();
                });
                document.addEventListener('gestureend', function(e) {
                  e.preventDefault();
                });

                // Prevent double tap to zoom on mobile
                var lastTouchEnd = 0;
                document.addEventListener('touchend', function(event) {
                  var now = Date.now();
                  if (now - lastTouchEnd <= 300) {
                    event.preventDefault();
                  }
                  lastTouchEnd = now;
                }, { passive: false });
              `,
            }}
          />
        </LanguageProvider>
      </body>
    </html>
  );
}
