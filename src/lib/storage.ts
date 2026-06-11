// Utilitários de Storage do Supabase.
import type { SupabaseClient } from "@supabase/supabase-js";

// Deriva o caminho do objeto dentro do bucket a partir da URL pública.
// Ex.: https://x.supabase.co/storage/v1/object/public/cifras/123_a.pdf
//   -> "123_a.pdf"
// Retorna null se a URL não for do bucket informado.
export function storagePathFromPublicUrl(
  publicUrl: string,
  bucket: string
): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

// Remove um arquivo do Storage a partir de sua URL pública.
// Best-effort: loga e segue se a URL não pertencer ao bucket ou a remoção
// falhar — não deve interromper o fluxo principal (banco é a fonte da verdade).
export async function removeStorageFileByUrl(
  supabase: SupabaseClient,
  publicUrl: string | null | undefined,
  bucket: string
): Promise<void> {
  if (!publicUrl) return;
  const path = storagePathFromPublicUrl(publicUrl, bucket);
  if (!path) return;
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    console.error(`Erro ao remover arquivo órfão de ${bucket}:`, error.message);
  }
}
