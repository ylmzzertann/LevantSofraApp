import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { sniffImage } from "./security";

/**
 * Dish photography.
 *
 * With Supabase configured, images go to a Storage bucket and get a public URL.
 * Without it they land in `public/uploads`, which works in development and on a
 * long-running server but **not** on Vercel, whose filesystem is read-only and
 * per-invocation. Set the Supabase variables before deploying, or dish photos
 * will vanish between requests.
 */

const BUCKET = process.env.SUPABASE_BUCKET ?? "dish-photos";
const MAX_BYTES = 5 * 1024 * 1024;

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key) : null;
}

export async function saveDishImage(dishId: string, file: File): Promise<string> {
  if (file.size > MAX_BYTES) {
    throw new Error("That image is over 5 MB — shrink it first.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  /* The type and the extension both come from the file's own bytes. The upload's
     name and declared type are whatever the uploader claimed, and trusting them
     let an HTML file called `dish.html`, declared as a PNG, be served back as a
     page from this site. */
  const image = sniffImage(bytes);
  if (!image) {
    throw new Error("That isn't a JPEG, PNG, WebP or AVIF image.");
  }

  const safeId = dishId.replace(/[^a-z0-9-]/g, "");
  const filename = `${safeId}-${Date.now()}${image.ext}`;

  const client = supabase();
  if (client) {
    const { error } = await client.storage
      .from(BUCKET)
      .upload(filename, bytes, { contentType: image.mime, upsert: false });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    return client.storage.from(BUCKET).getPublicUrl(filename).data.publicUrl;
  }

  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), bytes);
  return `/uploads/${filename}`;
}
