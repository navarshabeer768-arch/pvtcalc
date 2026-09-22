import imageCompression from 'browser-image-compression';

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Compresses an image to at most 2048px on the long edge and re-encodes it
 * through a <canvas>, which drops all EXIF metadata (including GPS) as a
 * side effect of the re-encode.
 */
export async function processImageForUpload(file: File): Promise<ProcessedImage> {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 2048,
    maxSizeMB: 2,
    useWebWorker: true,
    fileType: 'image/webp',
  });

  const bitmap = await createImageBitmap(compressed);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bitmap, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (!blob) throw new Error('Could not encode image');

  return { blob, width: bitmap.width, height: bitmap.height };
}
