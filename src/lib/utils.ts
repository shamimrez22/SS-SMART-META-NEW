import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type FilenameFormat = 'exact_title' | 'kebab_case' | 'snake_case';

/**
 * Sanitizes a stock asset filename for filesystem write across Windows, Mac, and Linux.
 * - Supports Exact Title format (preserving clean title case and spaces while stripping illegal filesystem chars).
 * - Supports SEO Kebab-case (lowercase with hyphens) and Snake-case (with underscores).
 * - Removes forbidden characters: \ / : * ? " < > |
 * - Caps base length at 150 characters at word boundary to protect filesystem limits while keeping full titles.
 * - Prevents Windows reserved filenames (CON, PRN, AUX, NUL, COM1-9, LPT1-9).
 * - Preserves or ensures valid stock asset extension (.jpg, .png, .eps, .mp4, etc.).
 */
export function sanitizeStockFilename(
  rawName: string | any, 
  originalName?: string, 
  fallbackExt: string = 'jpg',
  format: FilenameFormat = 'exact_title'
): string {
  const safeRaw = typeof rawName === 'string' 
    ? rawName 
    : (rawName && typeof rawName === 'object' && typeof rawName.title === 'string' ? rawName.title : String(rawName || ''));

  const knownExts = ['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp', 'gif', 'heic', 'avif', 'mp4', 'mov', 'avi', 'm4v', 'webm', 'mkv', 'eps', 'ai', 'svg'];
  let ext = (fallbackExt || 'jpg').toLowerCase().replace(/^\./, '');
  
  if (originalName && originalName.includes('.')) {
    const origExt = originalName.split('.').pop()?.toLowerCase() || '';
    if (knownExts.includes(origExt)) {
      ext = origExt;
    }
  } else if (safeRaw && safeRaw.includes('.')) {
    const rawExt = safeRaw.split('.').pop()?.toLowerCase() || '';
    if (knownExts.includes(rawExt)) {
      ext = rawExt;
    }
  }

  let base = safeRaw.trim();
  const extRegex = new RegExp(`\\.${ext}$`, 'i');
  base = base.replace(extRegex, '');
  
  for (const k of knownExts) {
    base = base.replace(new RegExp(`\\.${k}$`, 'i'), '');
  }

  let cleanBase = '';

  if (format === 'exact_title') {
    // Exact title format: clean illegal characters, preserve words, capitalization, and spaces
    cleanBase = base
      .replace(/[:]/g, ' - ')
      .replace(/[\\/|]/g, ' - ')
      .replace(/[*?"<>`']/g, '')
      .replace(/[\x00-\x1f\x7f]/g, '') // strip control chars
      .replace(/\s+/g, ' ')
      .replace(/\s*-\s*-+\s*/g, ' - ')
      .replace(/^[\s.-]+|[\s.-]+$/g, '');

    if (cleanBase.length > 150) {
      const cut = cleanBase.substring(0, 150);
      const lastSpace = cut.lastIndexOf(' ');
      cleanBase = (lastSpace > 40 ? cut.substring(0, lastSpace) : cut).replace(/^[\s.-]+|[\s.-]+$/g, '');
    }
  } else if (format === 'snake_case') {
    cleanBase = base
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (cleanBase.length > 150) {
      const cut = cleanBase.substring(0, 150);
      const lastUnderscore = cut.lastIndexOf('_');
      cleanBase = (lastUnderscore > 30 ? cut.substring(0, lastUnderscore) : cut).replace(/_+$/, '');
    }
  } else {
    // Default kebab-case
    cleanBase = base
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (cleanBase.length > 150) {
      const cut = cleanBase.substring(0, 150);
      const lastDash = cut.lastIndexOf('-');
      cleanBase = (lastDash > 30 ? cut.substring(0, lastDash) : cut).replace(/-+$/, '');
    }
  }

  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  if (reserved.test(cleanBase)) {
    cleanBase = `stock-${cleanBase}`;
  }

  if (!cleanBase && originalName) {
    const origBase = originalName.replace(/\.[^/.]+$/, '').trim();
    if (format === 'exact_title') {
      cleanBase = origBase.replace(/[:\\/|*?"<>]/g, '').trim().substring(0, 150);
    } else {
      cleanBase = origBase
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, format === 'snake_case' ? '_' : '-')
        .substring(0, 150)
        .replace(/^[-_]+|[-_]+$/g, '');
    }
  }

  if (!cleanBase) cleanBase = 'stock-asset';

  return `${cleanBase}.${ext}`;
}

export function sanitizeFilenameForFs(name: string, fallbackExt: string = 'jpg'): string {
  return sanitizeStockFilename(name, undefined, fallbackExt);
}


