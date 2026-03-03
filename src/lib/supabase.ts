import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

/** Storage 업로드용 (service_role 키로 RLS 우회) */
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "chat-images";

/** 이미지를 signed URL에서 다운로드 → Supabase Storage에 업로드 → 공개 URL 반환 */
export async function uploadImageToStorage(
  signedUrl: string,
  chatId: string,
  fileId: string,
  contentType: string
): Promise<string> {
  // 다운로드
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`이미지 다운로드 실패: ${res.status}`);
  const buffer = await res.arrayBuffer();

  // 확장자
  const ext = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : "jpg";
  const path = `${chatId}/${fileId}.${ext}`;

  // 업로드 (upsert로 중복 방지)
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: true });

  if (error) throw new Error(`Storage 업로드 실패: ${error.message}`);

  // 공개 URL
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
