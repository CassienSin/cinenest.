import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, is_admin, created_at")
    .eq("id", user.id)
    .single();

  // quick stats
  const { count: watchedCount } = await supabase
    .from("watch_progress")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("completed", true);

  const { count: favCount } = await supabase
    .from("favorites")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const joined = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="cn-bloom" />
      <div className="cn-grain" />

      <div className="relative z-10">
        {/* nav */}
        <nav className="grid grid-cols-[1.2fr_1fr_1fr_1fr] border-b border-line text-[13px]">
          <div className="border-r border-line px-5 py-3.5 font-semibold tracking-[-0.3px]">
            cinenest<span className="text-marquee">.</span>
          </div>
          <Link href="/" className="border-r border-line px-5 py-3.5 text-muted transition-colors hover:text-text">
            home
          </Link>
          <Link href="/library" className="border-r border-line px-5 py-3.5 text-muted transition-colors hover:text-text">
            library
          </Link>
          <div className="px-5 py-3.5 text-marquee">profile</div>
        </nav>

        <section className="border-b border-line px-5 py-10">
          <div className="cn-rise font-mono text-[11px] tracking-[0.2em] text-muted">
            YOUR SEAT
          </div>

          <div
            className="cn-rise mt-5 flex items-center gap-4"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2A3341] text-[24px] font-semibold">
              {(profile?.username || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-[24px] font-semibold tracking-[-0.6px]">
                {profile?.display_name || profile?.username}
              </div>
              <div className="mt-1 font-mono text-[11px] tracking-[0.1em] text-muted">
                @{profile?.username}
                {profile?.is_admin && (
                  <span className="ml-2 rounded-full border border-marquee px-2 py-0.5 text-marquee">
                    ADMIN
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* stats */}
          <div
            className="cn-rise mt-8 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-[8px] border border-line bg-line"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="bg-ink px-4 py-4 text-center">
              <div className="text-[22px] font-semibold text-marquee">{watchedCount ?? 0}</div>
              <div className="mt-1 font-mono text-[9px] tracking-[0.1em] text-muted">WATCHED</div>
            </div>
            <div className="bg-ink px-4 py-4 text-center">
              <div className="text-[22px] font-semibold text-marquee">{favCount ?? 0}</div>
              <div className="mt-1 font-mono text-[9px] tracking-[0.1em] text-muted">FAVORITES</div>
            </div>
            <div className="bg-ink px-4 py-4 text-center">
              <div className="text-[13px] font-semibold">{joined}</div>
              <div className="mt-1 font-mono text-[9px] tracking-[0.1em] text-muted">JOINED</div>
            </div>
          </div>
        </section>

        {/* edit form */}
        <section className="px-5 py-9">
          <ProfileForm
            initialDisplayName={profile?.display_name || ""}
            username={profile?.username}
          />
        </section>
      </div>
    </main>
  );
}