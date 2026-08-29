import { Navigation } from '@/components/Navigation';

// Admin layout — server-side auth is enforced per-page (analytics, manage-team)
// so the layout itself can stay thin.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-raasta-black">
      {/* Mobile header */}
      <div className="md:hidden sticky top-0 z-30 bg-raasta-black/95 backdrop-blur border-b border-raasta-border px-4 py-3 flex items-center gap-3">
        <div className="w-7 h-7 bg-gold-500 rounded-lg flex items-center justify-center shrink-0">
          <span className="text-raasta-black font-black text-[10px]">R</span>
        </div>
        <div>
          <span className="text-gold-500 font-bold text-sm">RAASTA</span>
          <span className="text-white font-bold text-sm"> Realty</span>
        </div>
        <span className="ml-auto text-[10px] text-gray-600 font-medium">Team Najeeb</span>
      </div>

      <Navigation />

      <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>
    </div>
  );
}
