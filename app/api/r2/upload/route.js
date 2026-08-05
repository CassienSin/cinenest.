import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@/lib/supabase/server";

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = "cinenest";

export async function POST(request) {
  // Only signed-in members can request an upload URL.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { key, contentType } = await request.json();

  if (!key) {
    return NextResponse.json({ error: "Missing key." }, { status: 400 });
  }

  const type =
    contentType ||
    (key.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t");

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: type,
    });

    // Valid for 5 minutes — plenty of time for one file to upload.
    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

    return NextResponse.json({ ok: true, uploadUrl, key });
  } catch (err) {
    console.error("Presign failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}