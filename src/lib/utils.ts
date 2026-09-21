import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes a filename for filesystem write across Windows, Mac, and Linux.
 * Removes forbidden characters: \ / : * ? " < > | # and control codes,
 * collapses spaces and dashes, and guarantees a valid non-empty name with extension.
 */
export function sanitizeFilenameForFs(name: string, fallbackExt: string = 'jpg'): string {
  if (!name || !name.trim()) return `stock_${Date.now()}.${fallbackExt}`;
  let clean = name.trim();

  // Extract extension
  const lastDot = clean.lastIndexOf('.');
  let base = lastDot > 0 ? clean.substring(0, lastDot) : clean;
  let ext = lastDot > 0 ? clean.substring(lastDot + 1) : fallbackExt;

  // Replace invalid filesystem characters on Windows / Mac / Linux: \ / : * ? " < > | #
  base = base.replace(/[/\\?%*:|"<>#]/g, '-');
  // Remove control characters (0-31 and 127-159)
  base = base.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  // Trim leading/trailing spaces, dots, and hyphens
  base = base.replace(/^[.\s-]+|[.\s-]+$/g, '');
  // Collapse whitespace and repeated dashes
  base = base.replace(/\s+/g, '-').replace(/-+/g, '-');
  if (!base || base === '-') base = `stock_${Date.now()}`;

  ext = ext.replace(/[/\\?%*:|"<>#\s]/g, '').toLowerCase() || fallbackExt;
  return `${base}.${ext}`;
}

