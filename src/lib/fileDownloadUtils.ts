import { toast } from "sonner";

export async function downloadFileFromUrl(signedUrl: string, fileName: string) {
  try {
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error("Fetch failed");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(blobUrl);
  } catch (e) {
    console.error("Download failed:", e);
    window.open(signedUrl, "_blank", "noopener,noreferrer");
  }
}

async function fetchAsPngBlob(imageUrl: string): Promise<Blob> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("Fetch failed");
  const blob = await response.blob();
  if (blob.type === "image/png") return blob;
  return convertToPng(blob);
}

export async function copyImageToClipboard(imageUrl: string) {
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
      throw new Error("Clipboard API unavailable");
    }

    // Pass a promise so the write stays tied to the user gesture (avoids NotAllowedError)
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": fetchAsPngBlob(imageUrl) }),
      ]);
    } catch {
      // Browsers that don't accept promises in ClipboardItem: resolve the blob first
      const pngBlob = await fetchAsPngBlob(imageUrl);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
    }

    toast.success("Imagem copiada para a área de transferência");
  } catch (e) {
    console.error("Copy failed:", e);
    // Last resort: copy the link so the user still gets something usable
    try {
      await navigator.clipboard.writeText(imageUrl);
      toast.success("Link da imagem copiado");
    } catch {
      toast.error("Não foi possível copiar a imagem");
    }
  }
}

async function convertToPng(blob: Blob): Promise<Blob> {
  // createImageBitmap decodes without an <img> element and preserves full resolution
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}

