import { extractText } from "unpdf";
import * as mammoth from "mammoth";

export async function parseBufferToText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  if (mimeType === "application/pdf") {
    const uint8 = new Uint8Array(buffer);
    const { text } = await extractText(uint8);
    return Array.isArray(text) ? text.join("\n") : text;
  }

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // Fallback: treat as UTF-8 text
  return buffer.toString("utf8");
}

