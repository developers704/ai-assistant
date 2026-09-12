"use client";

export default function SalesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-white/70">Sales page failed to load.</p>
      <p className="max-w-xl text-[13px] text-rose-200/90 break-words">
        {error.message || "Unknown client error"}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15"
      >
        Retry
      </button>
    </div>
  );
}
