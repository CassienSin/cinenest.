export default function Loading() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="cn-bloom" />
      <div className="cn-grain" />

      <div className="relative z-10">
        <nav className="grid grid-cols-[1.2fr_1fr_1fr_1fr] border-b border-line text-[13px]">
          <div className="border-r border-line px-5 py-3.5 font-semibold tracking-[-0.3px]">
            cinenest<span className="text-marquee">.</span>
          </div>
          <div className="border-r border-line px-5 py-3.5 text-muted">home</div>
          <div className="border-r border-line px-5 py-3.5">library</div>
          <div className="px-5 py-3.5" />
        </nav>

        <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
          <span className="text-[15px] font-semibold tracking-[-0.3px]">library</span>
          <div className="cn-shimmer h-3 w-16 rounded" />
        </div>

        {/* filter chips */}
        <div className="flex gap-2 border-b border-line px-5 py-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="cn-shimmer h-6 w-16 rounded-full" />
          ))}
        </div>

        {/* poster grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="border-b border-r border-line p-4">
              <div className="cn-shimmer mb-3 aspect-[2/3] rounded-[4px]" />
              <div className="cn-shimmer h-3 w-3/4 rounded" />
              <div className="cn-shimmer mt-2 h-2 w-1/2 rounded" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}