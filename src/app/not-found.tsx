import Link from "next/link";
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="text-2xl font-semibold">This page doesn&apos;t exist</h1>
      <Link href="/" className="text-sm font-medium text-brand-600 hover:underline">Go to your dashboard</Link>
    </div>
  );
}
