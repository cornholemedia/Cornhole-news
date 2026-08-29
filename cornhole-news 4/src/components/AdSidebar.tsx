export default function AdSidebar() {
  return (
    <aside className="hidden w-[300px] shrink-0 lg:block">
      <div className="sticky top-4 space-y-4">
        {/* Primary ad slot */}
        <div className="rounded border border-[#e0e0e0] bg-white p-3 text-center">
          <p className="mb-2 text-xs uppercase tracking-wide text-[#666]">
            Advertisement
          </p>
          <div className="flex h-[250px] items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400">
            300 × 250
            <br />
            Ad Placeholder
          </div>
          <p className="mt-2 text-xs text-[#3f679b]">
            <a href="/advertise" className="hover:underline">
              Advertise with us
            </a>
          </p>
        </div>

        {/* Secondary taller slot */}
        <div className="rounded border border-[#e0e0e0] bg-white p-3 text-center">
          <p className="mb-2 text-xs uppercase tracking-wide text-[#666]">
            Advertisement
          </p>
          <div className="flex h-[400px] items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400">
            300 × 600
            <br />
            Ad Placeholder
          </div>
        </div>
      </div>
    </aside>
  );
}
