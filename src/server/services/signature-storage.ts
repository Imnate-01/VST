import { put } from "@vercel/blob";

/**
 * Guarda la imagen PNG de una firma y devuelve la URL a persistir.
 *
 * En producción usa Vercel Blob. Si no hay BLOB_READ_WRITE_TOKEN (típico en
 * local), guarda la imagen como data URL en la propia columna. Es correcto pero
 * pesa ~10-30 KB por fila: no lo dejes así en producción.
 */

const DATA_URL_PREFIX = "data:image/png;base64,";

export function isDataUrl(url: string): boolean {
  return url.startsWith("data:");
}

export function parseSignatureDataUrl(dataUrl: string): Buffer {
  if (!dataUrl.startsWith(DATA_URL_PREFIX)) {
    throw new Error("La firma debe ser un PNG en data URL.");
  }

  const base64 = dataUrl.slice(DATA_URL_PREFIX.length);
  const buffer = Buffer.from(base64, "base64");

  if (buffer.length === 0) {
    throw new Error("La firma está vacía.");
  }

  // Cota defensiva: una firma dibujada a mano no debería pesar más que esto.
  if (buffer.length > 1_000_000) {
    throw new Error("La firma excede el tamaño máximo de 1 MB.");
  }

  return buffer;
}

export async function storeSignatureImage(params: {
  dataUrl: string;
  reportId: string;
  signatureKey: string;
}): Promise<string> {
  const buffer = parseSignatureDataUrl(params.dataUrl);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return params.dataUrl;
  }

  const blob = await put(
    `signatures/${params.reportId}/${params.signatureKey}.png`,
    buffer,
    { access: "public", contentType: "image/png", addRandomSuffix: true }
  );

  return blob.url;
}
