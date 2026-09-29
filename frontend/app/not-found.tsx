import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ink text-bone p-4">
      <h2 className="text-xl font-mono text-indigo mb-2">404 - Not Found</h2>
      <p className="text-sm text-bone-subtle mb-4">The requested resource could not be found.</p>
      <Link
        href="/"
        className="px-4 py-2 rounded-xl bg-bone text-ink text-xs font-semibold hover:bg-bone-muted transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
