import { SupabaseClient } from "@supabase/supabase-js";

export async function uploadFile(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File | Blob,
  contentType?: string
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: contentType || (file instanceof File ? file.type : "application/octet-stream"),
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

export async function persistImageFromUrl(
  supabase: SupabaseClient,
  imageUrl: string,
  channelId: string
): Promise<string> {
  // Download the remote image
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to download image: ${response.statusText}`);

  const contentType = response.headers.get("content-type") || "image/png";
  const blob = await response.blob();

  // Determine file extension from content type
  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const ext = extMap[contentType] || "png";
  const id = crypto.randomUUID();
  const path = `${channelId}/${id}/generated.${ext}`;

  const publicUrl = await uploadFile(supabase, "images", path, blob, contentType);
  return publicUrl;
}
