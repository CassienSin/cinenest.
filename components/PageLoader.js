export default function PageLoader({ showNav = true }) {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="cn-bloom" />
      <div className="cn-grain" />

      <div className="relative z-10">
        {showNav && (
          <nav className="grid grid-cols-[1.2fr_1fr_1fr_1fr] border-b border-line text-[13px]">
            <div className="border-r border-line px-5 py-3.5 font-semibold tracking-[-0.3px]">
              cinenest<span className="text-marquee">.</span>
            </div>
            <div className="border-r border-line px-5 py-3.5 text-muted">home</div>
            <div className="border-r border-line px-5 py-3.5 text-muted">library</div>
            <div className="px-5 py-3.5" />
          </nav>
        )}

        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="cn-spinner" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted">
              LOADING
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}