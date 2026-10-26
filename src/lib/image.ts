/**
 * Comprime um arquivo de imagem no navegador via HTML5 Canvas.
 * Redimensiona mantendo a proporção (máximo `maxSide` px no maior lado)
 * e exporta como JPEG com `quality` (0 a 1).
 */
export function compressImageFile(
  file: File,
  maxSide = 1600,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("Não foi possível obter contexto 2D do Canvas."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Falha ao carregar imagem."));
    };

    img.src = objectUrl;
  });
}
