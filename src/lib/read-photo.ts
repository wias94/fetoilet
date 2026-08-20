const MAX_EDGE = 720;
const MAX_CHARS = 280_000;

export async function readStallPhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("只要图片");
  if (file.size > 12 * 1024 * 1024) throw new Error("图太大，换一张");

  const bitmap = await createImageBitmap(file);
  try {
    let w = bitmap.width;
    let h = bitmap.height;
    if (w < 32 || h < 32) throw new Error("图太小");
    if (w > MAX_EDGE || h > MAX_EDGE) {
      const scale = MAX_EDGE / Math.max(w, h);
      w = Math.max(1, Math.round(w * scale));
      h = Math.max(1, Math.round(h * scale));
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画不了");
    ctx.drawImage(bitmap, 0, 0, w, h);
    for (const quality of [0.8, 0.68, 0.55, 0.42]) {
      const data = canvas.toDataURL("image/jpeg", quality);
      if (data.startsWith("data:image/jpeg") && data.length <= MAX_CHARS) return data;
    }
    throw new Error("压完还是太大，换一张");
  } finally {
    bitmap.close();
  }
}
