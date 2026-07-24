import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function POST(request) {
  const body = await request.json();

  const email = body.email?.trim().toLowerCase();
  const password = body.password || "";
  const username = body.username?.trim().toLowerCase();
  const code = body.code?.trim().toUpperCase();

  if (!email || !password || !username || !code) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json(
      { error: "Username: 3–20 characters, lowercase letters, numbers, underscore only." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  // 1. Is the code real and unclaimed?
  const { data: invite } = await admin
    .from("invites")
    .select("code, claimed_by")
    .eq("code", code)
    .maybeSingle();

  if (!invite || invite.claimed_by) {
    return NextResponse.json({ error: "That invite code isn't valid." }, { status: 403 });
  }

  // 2. Is the username free?
  const { data: taken } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (taken) {
    return NextResponse.json({ error: "That username is taken." }, { status: 409 });
  }

  // 3. Create the account (the database trigger makes the profile).
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });

  if (createError || !created?.user) {
    const exists = createError?.message?.includes("already been registered");
    return NextResponse.json(
      { error: exists ? "That email already has an account." : "Could not create the account." },
      { status: 400 }
    );
  }

  // 4. Burn the invite code.
  const { error: claimError } = await admin
    .from("invites")
    .update({ claimed_by: created.user.id, claimed_at: new Date().toISOString() })
    .eq("code", code)
    .is("claimed_by", null);

  if (claimError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: "That invite was just claimed by someone else." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}