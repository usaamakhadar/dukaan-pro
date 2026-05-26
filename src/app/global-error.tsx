'use client';

import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen bg-zinc-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-800 rounded-2xl shadow-2xl border border-zinc-700 p-8 text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500 mb-2">
              <AlertTriangle size={32} />
            </div>
            
            <div>
              <h2 className="text-2xl font-black text-white mb-2">Critical System Error</h2>
              <p className="text-zinc-400 font-medium text-sm mb-4">
                A critical error occurred at the application root.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => reset()}
                className="w-full py-4 px-4 rounded-xl bg-white hover:bg-zinc-200 text-[#141b2d] font-bold transition-colors"
              >
                Reload Application
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
