import { supabase } from "@/integrations/supabase/client";

/**
 * Converts a data URL to a Blob using fetch() API.
 * This avoids stack overflow issues that occur with atob() on large base64 strings.
 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return response.blob();
}

/**
 * Scans text content for base64 data URLs in <img> tags,
 * uploads them to storage, and replaces with real URLs.
 * Processes images sequentially to avoid memory pressure.
 */
export async function uploadInlineImages(content: string): Promise<string> {
  // Use a non-greedy match to find img tags with data: src
  // We split content to find data URLs without loading them all into regex groups
  const imgRegex = /<img\s+[^>]*src="(data:[^"]+)"[^>]*\/?>/g;
  const matches: { full: string; dataUrl: string; width?: string }[] = [];

  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    // Extract width if present
    const widthMatch = match[0].match(/width="(\d+)"/);
    matches.push({ 
      full: match[0], 
      dataUrl: match[1], 
      width: widthMatch?.[1] 
    });
  }

  if (matches.length === 0) return content;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  let result = content;

  // Process each image sequentially to avoid memory issues
  for (const m of matches) {
    try {
      const blob = await dataUrlToBlob(m.dataUrl);
      const ext = blob.type.split("/")[1] === "jpeg" ? "jpg" : (blob.type.split("/")[1] || "png");
      const filePath = `inline/${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("demand-attachments")
        .upload(filePath, blob, { contentType: blob.type });

      if (uploadError) {
        console.error("Failed to upload inline image:", uploadError);
        continue;
      }

      const { data: signedData } = await supabase.storage
        .from("demand-attachments")
        .createSignedUrl(filePath, 31536000); // 1 year

      const url = signedData?.signedUrl;
      if (!url) continue;

      const replacement = m.width
        ? `<img src="${url}" width="${m.width}" />`
        : `<img src="${url}" />`;

      result = result.replace(m.full, replacement);
    } catch (err) {
      console.error("Error uploading inline image:", err);
      // Replace failed image with placeholder instead of keeping huge base64
      result = result.replace(m.full, '[imagem não enviada]');
    }
  }

  return result;
}
