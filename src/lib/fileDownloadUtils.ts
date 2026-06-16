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

export async function copyImageToClipboard(imageUrl: string) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("Fetch failed");
    const blob = await response.blob();

    // Convert to PNG if needed (clipboard API requires image/png)
    let pngBlob = blob;
    if (blob.type !== "image/png") {
      pngBlob = await convertToPng(blob);
    }

    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": pngBlob }),
    ]);
    toast.success("Imagem copiada para a área de transferência");
  } catch (e) {
    console.error("Copy failed:", e);
    toast.error("Não foi possível copiar a imagem");
  }
}

function convertToPng(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No canvas context"));
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("toBlob failed"));
      }, "image/png");
    };
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = URL.createObjectURL(blob);
  });
}
