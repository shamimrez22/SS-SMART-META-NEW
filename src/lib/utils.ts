import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Sanitizes a stock asset filename for filesystem write across Windows, Mac, and Linux.
 * - Enforces lowercase clean ASCII kebab-case: a-z, 0-9, and single hyphens.
 * - Removes forbidden characters, dots, quotes, punctuation, brackets, path separators.
 * - Caps base length at 55 characters at word boundary to prevent Windows MAX_PATH (260 chars) or Chrome FSA failures.
 * - Prevents Windows reserved filenames (CON, PRN, AUX, NUL, COM1-9, LPT1-9).
 * - Preserves or ensures valid stock asset extension (.jpg, .png, .eps, .mp4, etc.).
 */
export function sanitizeStockFilename(
  rawName: string, 
  originalName?: string, 
  fallbackExt: string = 'jpg'
): string {
  const knownExts = ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp', 'gif', 'heic', 'avif', 'mp4', 'mov', 'avi', 'm4v', 'webm', 'mkv', 'eps', 'ai', 'svg'];
  let ext = (fallbackExt || 'jpg').toLowerCase().replace(/^\./, '');
  
  if (originalName && originalName.includes('.')) {
    const origExt = originalName.split('.').pop()?.toLowerCase() || '';
    if (knownExts.includes(origExt)) {
      ext = origExt;
    }
  } else if (rawName && rawName.includes('.')) {
    const rawExt = rawName.split('.').pop()?.toLowerCase() || '';
    if (knownExts.includes(rawExt)) {
      ext = rawExt;
    }
  }

  let base = (rawName || '').trim();
  const extRegex = new RegExp(`\\.${ext}$`, 'i');
  base = base.replace(extRegex, '');
  
  for (const k of knownExts) {
    base = base.replace(new RegExp(`\\.${k}$`, 'i'), '');
  }

  let cleanBase = base
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  if (reserved.test(cleanBase)) {
    cleanBase = `stock-${cleanBase}`;
  }

  if (cleanBase.length > 55) {
    const cut = cleanBase.substring(0, 55);
    const lastDash = cut.lastIndexOf('-');
    cleanBase = (lastDash > 15 ? cut.substring(0, lastDash) : cut).replace(/-+$/, '');
  }

  if (!cleanBase && originalName) {
    const origBase = originalName.replace(/\.[^/.]+$/, '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (origBase) cleanBase = origBase.substring(0, 55).replace(/-+$/, '');
  }

  if (!cleanBase) cleanBase = 'stock-image';

  return `${cleanBase}.${ext}`;
}

export function sanitizeFilenameForFs(name: string, fallbackExt: string = 'jpg'): string {
  return sanitizeStockFilename(name, undefined, fallbackExt);
}


