'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[dashboard] render error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 flex flex-col items-center justify-center">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-red-400 mb-2">Something went wrong</h1>
        <p className="text-slate-400 text-sm mb-4">
          The dashboard failed to load. This is usually a database connection issue.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-500 mb-4 font-mono break-all">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={() => unstable_retry()}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
