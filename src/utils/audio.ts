/**
 * Safely decodes a base64 string, handling any potential whitespaces,
 * newlines, invalid characters, or incorrect padding.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (!base64) return new Uint8Array(0);

  // Remove data URI scheme prefix if present
  let cleanBase64 = base64.trim();
  if (cleanBase64.startsWith("data:")) {
    const commaIndex = cleanBase64.indexOf(",");
    if (commaIndex !== -1) {
      cleanBase64 = cleanBase64.substring(commaIndex + 1);
    }
  }

  // Remove any characters that are not valid base64 characters
  cleanBase64 = cleanBase64.replace(/[^A-Za-z0-9+/]/g, "");

  // Fix padding
  const padLength = (4 - (cleanBase64.length % 4)) % 4;
  if (padLength > 0 && padLength < 3) {
    cleanBase64 = cleanBase64.padEnd(cleanBase64.length + padLength, "=");
  }

  try {
    const binary = atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    console.error("[base64ToUint8Array] Error decoding base64:", error);
    return new Uint8Array(0);
  }
}

/**
 * Converts base64 to a Blob URL
 */
export function base64ToBlobUrl(base64: string, mimeType = "audio/wav"): string {
  const bytes = base64ToUint8Array(base64);
  if (bytes.length === 0) return "";
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}
