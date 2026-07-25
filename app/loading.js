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
          <div className="border-r border-line px-5 py-3.5">home</div>
          <div className="border-r border-line px-5 py-3.5 text-muted">library</div>
          <div className="px-5 py-3.5" />
        </nav>

        {/* hero skeleton */}
        <section className="border-b border-line px-5 py-12">
          <div className="cn-shimmer h-3 w-40 rounded" />
          <div className="cn-shimmer mt-4 h-10 w-2/3 max-w-md rounded" />
          <div className="cn-shimmer mt-3 h-3 w-48 rounded" />
          <div className="mt-7 flex gap-3">
            <div className="cn-shimmer h-11 w-28 rounded-[4px]" />
            <div className="cn-shimmer h-11 w-24 rounded-[4px]" />
          </div>
        </section>

        {/* presence bar */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
          <div className="cn-shimmer h-2 w-2 rounded-full" />
          <div className="cn-shimmer h-3 w-52 rounded" />
        </div>

        {/* recently added skeleton */}
        <div className="px-5 py-4">
          <div className="cn-shimmer h-4 w-32 rounded" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
          {[...Array(6)].map((_, i) => (
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