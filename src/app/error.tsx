'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Optional: Log the error to an error reporting service like Sentry here in the future
    console.error("ErrorBoundary caught an error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-zinc-200 p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 mb-2">
          <AlertTriangle size={32} />
        </div>
        
        <div>
          <h2 className="text-2xl font-black text-[#141b2d] mb-2">Something went wrong!</h2>
          <p className="text-zinc-500 font-medium text-sm mb-4">
            A temporary error occurred in the system. Don't worry, your data is safe.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-red-50 p-3 rounded-lg text-left text-xs text-red-600 overflow-auto max-h-32 mb-4 font-mono">
              {error.message}
            </div>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="flex-1 py-3 px-4 rounded-xl border-2 border-zinc-200 text-zinc-700 font-bold hover:bg-zinc-50 transition-colors"
          >
            Go to Dashboard
          </button>
          
          <button
            onClick={() => reset()}
            className="flex-1 py-3 px-4 rounded-xl bg-[#141b2d] hover:bg-[#1a233a] text-white font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#141b2d]/20"
          >
            <RefreshCcw size={18} />
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
