export default function Loading() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-16">
      <div className="rounded-2xl border border-green-100 bg-white px-6 py-5 text-center shadow-sm">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-green-100 border-t-green-700" />
        <p className="text-sm font-medium text-green-900">Loading Exspend…</p>
      </div>
    </main>
  );
}