import * as piexif from "piexifjs";
import { StockMetadata } from '../types';

// Helper to convert string to UTF-16LE byte array for Windows/Exif metadata
export function toUtf16Le(str: string): number[] {
  const result: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    result.push(code & 0xff);
    result.push((code >> 8) & 0xff);
  }
  result.push(0, 0);
  return result;
}

// Helper to escape XML special characters
export function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// CRC32 table for PNG chunk checksums
const crcTable: number[] = new Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function calcCrc(buf: Uint8Array, offset: number, length: number): number {
  let c = 0xffffffff;
  for (let i = offset; i < offset + length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const len = data.length;
  const chunk = new Uint8Array(4 + 4 + len + 4);
  const view = new DataView(chunk.buffer);
  
  view.setUint32(0, len);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  
  const crc = calcCrc(chunk, 4, 4 + len);
  view.setUint32(8 + len, crc);
  return chunk;
}

function createTextChunk(keyword: string, text: string): Uint8Array {
  const enc = new TextEncoder();
  const kwBytes = enc.encode(keyword);
  const textBytes = enc.encode(text);
  const data = new Uint8Array(kwBytes.length + 1 + textBytes.length);
  data.set(kwBytes, 0);
  data[kwBytes.length] = 0; // null separator
  data.set(textBytes, kwBytes.length + 1);
  return createPngChunk('tEXt', data);
}

function createItxtChunk(keyword: string, text: string): Uint8Array {
  const enc = new TextEncoder();
  const kwBytes = enc.encode(keyword);
  const textBytes = enc.encode(text);
  // keyword + null + flag(0) + method(0) + lang(null) + transKeyword(null) + text
  const data = new Uint8Array(kwBytes.length + 1 + 1 + 1 + 1 + 1 + textBytes.length);
  let pos = 0;
  data.set(kwBytes, pos); pos += kwBytes.length;
  data[pos++] = 0; // null
  data[pos++] = 0; // comp flag
  data[pos++] = 0; // comp method
  data[pos++] = 0; // null for lang
  data[pos++] = 0; // null for transKeyword
  data.set(textBytes, pos);
  return createPngChunk('iTXt', data);
}

// Generate Adobe Standard XMP Packet string (Fully compliant with Adobe Photoshop, Bridge, Lightroom & Stock agencies)
export function createXmpPacket(
  metadata: {
    title?: string;
    description?: string;
    keywords?: string;
    rating?: number;
    category?: string;
  },
  mimeType: string = 'image/jpeg'
): string {
  const title = escapeXml(metadata.title || '');
  const description = escapeXml(metadata.description || '');
  const category = escapeXml(metadata.category || 'Commercial');
  const keywordsList = (metadata.keywords || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
  const rating = (metadata.rating !== undefined && metadata.rating > 0) ? metadata.rating : 5;

  return `<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 7.0-c000 1.000000, 0000/00/00-00:00:00">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
    xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"
    xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"
    xmlns:tiff="http://ns.adobe.com/tiff/1.0/">
   <dc:format>${mimeType}</dc:format>
   <dc:title>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${title}</rdf:li>
    </rdf:Alt>
   </dc:title>
   <dc:description>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">${description}</rdf:li>
    </rdf:Alt>
   </dc:description>
   <dc:subject>
    <rdf:Bag>
     ${keywordsList.map(k => `<rdf:li>${escapeXml(k)}</rdf:li>`).join('\n     ')}
    </rdf:Bag>
   </dc:subject>
   <dc:creator>
    <rdf:Seq>
     <rdf:li>Stock Contributor</rdf:li>
    </rdf:Seq>
   </dc:creator>
   <xmp:Rating>${rating}</xmp:Rating>
   <xmp:RatingPercent>99</xmp:RatingPercent>
   <xmp:Label>Select</xmp:Label>
   <photoshop:Headline>${title}</photoshop:Headline>
   <photoshop:Credit>Stock Contributor</photoshop:Credit>
   <photoshop:CaptionWriter>Stock Contributor</photoshop:CaptionWriter>
   <photoshop:Category>${category}</photoshop:Category>
   <tiff:ImageDescription>${description}</tiff:ImageDescription>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

// Build standard Adobe Photoshop 3.0 APP13 8BIM IPTC-NAA Segment for JPEGs
export function createIptcApp13Block(
  title: string,
  description: string,
  keywords: string,
  category?: string,
  author: string = 'Stock Contributor'
): Uint8Array {
  const enc = new TextEncoder();
  const records: Uint8Array[] = [];

  function addTag(recordNum: number, tagNum: number, dataBytes: Uint8Array) {
    if (!dataBytes || dataBytes.length === 0) return;
    const len = dataBytes.length;
    // Tag marker (0x1C), Record number, Tag number, Length (2 bytes big-endian)
    const header = new Uint8Array([0x1C, recordNum, tagNum, (len >> 8) & 0xff, len & 0xff]);
    records.push(header, dataBytes);
  }

  // 1:90 Coded Character Set (UTF-8 escape sequence: ESC % G -> 0x1B, 0x25, 0x47)
  addTag(1, 90, new Uint8Array([0x1B, 0x25, 0x47]));

  // 2:05 Object Name (Title - core stock title)
  if (title) addTag(2, 5, enc.encode(title.substring(0, 64)));

  // 2:105 Headline
  if (title) addTag(2, 105, enc.encode(title.substring(0, 256)));

  // 2:120 Caption / Abstract (Description)
  if (description) addTag(2, 120, enc.encode(description.substring(0, 2000)));

  // 2:25 Keywords (Every keyword MUST be its own separate 2:25 tag for full stock platform compatibility)
  const kwList = (keywords || '').split(',').map(k => k.trim()).filter(Boolean);
  for (const kw of kwList) {
    addTag(2, 25, enc.encode(kw.substring(0, 64)));
  }

  // 2:15 Category
  if (category) addTag(2, 15, enc.encode(category.substring(0, 3)));

  // 2:80 By-line (Author/Creator)
  if (author) addTag(2, 80, enc.encode(author.substring(0, 32)));

  // 2:116 Copyright Notice
  addTag(2, 116, enc.encode(`Copyright ${new Date().getFullYear()}`));

  // Total IPTC byte length
  const iptcLen = records.reduce((sum, r) => sum + r.length, 0);
  const iptcBuf = new Uint8Array(iptcLen);
  let pos = 0;
  for (const r of records) {
    iptcBuf.set(r, pos);
    pos += r.length;
  }

  // Adobe Photoshop 3.0 8BIM Resource Block (ID 0x0404 for IPTC-NAA)
  // '8BIM' (4 bytes), ID 0x0404 (2 bytes), Name Pascal string ('\0\0' 2 bytes), Size (4 bytes big-endian)
  const bimHeader = new Uint8Array(12);
  bimHeader.set([0x38, 0x42, 0x49, 0x4D], 0); // '8BIM'
  bimHeader.set([0x04, 0x04], 4);             // IPTC-NAA ID
  bimHeader.set([0x00, 0x00], 6);             // Empty string, even padded
  bimHeader[8] = (iptcLen >> 24) & 0xff;
  bimHeader[9] = (iptcLen >> 16) & 0xff;
  bimHeader[10] = (iptcLen >> 8) & 0xff;
  bimHeader[11] = iptcLen & 0xff;

  const psHeader = enc.encode('Photoshop 3.0\0');
  const payloadLen = psHeader.length + bimHeader.length + iptcLen;
  const segLen = 2 + payloadLen;

  const app13 = new Uint8Array(4 + payloadLen);
  app13[0] = 0xFF;
  app13[1] = 0xED; // Marker APP13
  app13[2] = (segLen >> 8) & 0xff;
  app13[3] = segLen & 0xff;

  let offset = 4;
  app13.set(psHeader, offset); offset += psHeader.length;
  app13.set(bimHeader, offset); offset += bimHeader.length;
  app13.set(iptcBuf, offset);

  return app13;
}

// Build standard Adobe APP1 XMP segment for JPEGs
export function createXmpApp1Block(xmpString: string): Uint8Array {
  const enc = new TextEncoder();
  const idBytes = enc.encode('http://ns.adobe.com/xap/1.0/\0');
  const xmpBytes = enc.encode(xmpString);
  const payloadLen = idBytes.length + xmpBytes.length;
  const segLen = 2 + payloadLen;

  const app1 = new Uint8Array(4 + payloadLen);
  app1[0] = 0xFF;
  app1[1] = 0xE1; // Marker APP1
  app1[2] = (segLen >> 8) & 0xff;
  app1[3] = segLen & 0xff;
  app1.set(idBytes, 4);
  app1.set(xmpBytes, 4 + idBytes.length);
  return app1;
}

// Insert custom APP segments into JPEG after SOI and APP0/Exif APP1
function insertSegmentsIntoJpeg(jpegBytes: Uint8Array, segmentsToInsert: Uint8Array[]): Uint8Array {
  if (jpegBytes[0] !== 0xFF || jpegBytes[1] !== 0xD8) {
    return jpegBytes; // Not a valid JPEG
  }

  // Remove existing XMP APP1 or IPTC APP13 to prevent duplication
  const cleanParts: Uint8Array[] = [];
  let cur = 0;
  let pos = 2;
  const xmpHeader = 'http://ns.adobe.com/xap/1.0/';
  const iptcHeader = 'Photoshop 3.0';

  while (pos < jpegBytes.length - 4) {
    if (jpegBytes[pos] === 0xFF) {
      const marker = jpegBytes[pos + 1];
      if (marker === 0xDA || marker === 0xD9) {
        // Start of scan (SOS) or EOI
        break;
      }
      const segLen = (jpegBytes[pos + 2] << 8) | jpegBytes[pos + 3];
      const nextPos = pos + 2 + segLen;

      let isOldXmpOrIptc = false;
      if (marker === 0xE1 && segLen > 30) {
        const str = String.fromCharCode(...jpegBytes.subarray(pos + 4, pos + 4 + 28));
        if (str.startsWith(xmpHeader)) isOldXmpOrIptc = true;
      } else if (marker === 0xED && segLen > 15) {
        const str = String.fromCharCode(...jpegBytes.subarray(pos + 4, pos + 4 + 14));
        if (str.startsWith(iptcHeader)) isOldXmpOrIptc = true;
      }

      if (isOldXmpOrIptc) {
        cleanParts.push(jpegBytes.subarray(cur, pos));
        cur = nextPos;
      }
      pos = nextPos;
    } else {
      pos++;
    }
  }
  cleanParts.push(jpegBytes.subarray(cur));

  // Merge cleaned parts
  const totalCleanLen = cleanParts.reduce((s, p) => s + p.length, 0);
  const cleanJpeg = new Uint8Array(totalCleanLen);
  let cPos = 0;
  for (const p of cleanParts) {
    cleanJpeg.set(p, cPos);
    cPos += p.length;
  }

  // Find insert position (after APP0 or after Exif APP1)
  let targetInsert = 2;
  pos = 2;
  while (pos < cleanJpeg.length - 4) {
    if (cleanJpeg[pos] === 0xFF) {
      const marker = cleanJpeg[pos + 1];
      if (marker === 0xE0) { // APP0 JFIF
        const segLen = (cleanJpeg[pos + 2] << 8) | cleanJpeg[pos + 3];
        pos += 2 + segLen;
        targetInsert = pos;
        continue;
      }
      if (marker === 0xE1) { // APP1 Exif
        const segLen = (cleanJpeg[pos + 2] << 8) | cleanJpeg[pos + 3];
        const id = String.fromCharCode(...cleanJpeg.subarray(pos + 4, pos + 10));
        if (id.startsWith('Exif')) {
          pos += 2 + segLen;
          targetInsert = pos;
          continue;
        }
      }
      break;
    }
    pos++;
  }

  const addedLen = segmentsToInsert.reduce((s, seg) => s + seg.length, 0);
  const finalJpeg = new Uint8Array(cleanJpeg.length + addedLen);

  finalJpeg.set(cleanJpeg.subarray(0, targetInsert), 0);
  let oPos = targetInsert;
  for (const seg of segmentsToInsert) {
    finalJpeg.set(seg, oPos);
    oPos += seg.length;
  }
  finalJpeg.set(cleanJpeg.subarray(targetInsert), oPos);
  return finalJpeg;
}

// Embed EXIF + IPTC + XMP into JPEG Image Blob (Rock-Solid for Windows Explorer, Adobe Photoshop & Stock agencies)
export async function embedMetadataInImageBlob(
  file: File | Blob,
  metadata: Partial<StockMetadata>
): Promise<Blob> {
  try {
    const buffer = await file.arrayBuffer();
    const jpegBytes = new Uint8Array(buffer);

    // Validate JPEG SOI marker (0xFF, 0xD8)
    if (jpegBytes.length < 4 || jpegBytes[0] !== 0xFF || jpegBytes[1] !== 0xD8) {
      console.warn("Not a valid JPEG, returning original file");
      return file;
    }

    const title = (metadata.title || '').trim();
    const description = (metadata.description || '').trim();
    const rawKeywords = (metadata.keywords || '').trim();
    const rating = (metadata.rating !== undefined && metadata.rating > 0) ? metadata.rating : 5;

    // Windows Explorer requires semicolons between keywords in XPKeywords
    const windowsKeywords = rawKeywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean)
      .join('; ');

    // 1. Prepare Standard Exif 0th IFD tags (Windows Explorer Properties -> Details & Adobe)
    let zeroth: any = {};
    let exif: any = {};

    zeroth[piexif.ImageIFD.ImageDescription] = description;
    zeroth[piexif.ImageIFD.XPTitle] = toUtf16Le(title);
    zeroth[piexif.ImageIFD.XPSubject] = toUtf16Le(title);
    zeroth[piexif.ImageIFD.XPKeywords] = toUtf16Le(windowsKeywords);
    zeroth[piexif.ImageIFD.XPComment] = toUtf16Le(description);
    zeroth[piexif.ImageIFD.XPAuthor] = toUtf16Le('Stock Contributor');
    zeroth[piexif.ImageIFD.Rating] = rating;               // Tag 18246 (1-5 stars)
    zeroth[piexif.ImageIFD.RatingPercent] = 99;           // Tag 18249 (99% = 5 stars in Windows Explorer)
    zeroth[piexif.ImageIFD.Artist] = 'Stock Contributor';
    zeroth[piexif.ImageIFD.Copyright] = `Copyright ${new Date().getFullYear()}`;

    let exifDump = '';
    try {
      exifDump = piexif.dump({ '0th': zeroth, Exif: exif, GPS: {} });
    } catch (dumpErr) {
      console.warn("Initial EXIF dump failed, retrying with minimal tags:", dumpErr);
      const cleanZeroth: any = {
        [piexif.ImageIFD.ImageDescription]: description,
        [piexif.ImageIFD.XPTitle]: toUtf16Le(title),
        [piexif.ImageIFD.XPKeywords]: toUtf16Le(windowsKeywords),
        [piexif.ImageIFD.Rating]: rating,
        [piexif.ImageIFD.RatingPercent]: 99
      };
      exifDump = piexif.dump({ '0th': cleanZeroth, Exif: {}, GPS: {} });
    }

    // Convert exifDump string directly into binary bytes for APP1 segment (0xFF, 0xE1)
    const exifDumpBytes = new Uint8Array(exifDump.length);
    for (let i = 0; i < exifDump.length; i++) {
      exifDumpBytes[i] = exifDump.charCodeAt(i) & 0xff;
    }

    const segLen = 2 + exifDumpBytes.length;
    const app1Exif = new Uint8Array(4 + exifDumpBytes.length);
    app1Exif[0] = 0xFF;
    app1Exif[1] = 0xE1;
    app1Exif[2] = (segLen >> 8) & 0xff;
    app1Exif[3] = segLen & 0xff;
    app1Exif.set(exifDumpBytes, 4);

    // 2. Standard Adobe XMP APP1 Packet (0xFF, 0xE1)
    const xmpString = createXmpPacket(metadata, 'image/jpeg');
    const xmpApp1 = createXmpApp1Block(xmpString);

    // 3. Photoshop 3.0 IPTC-NAA APP13 Block (0xFF, 0xED)
    const iptcApp13 = createIptcApp13Block(title, description, rawKeywords, metadata.category);

    // 4. Clean existing metadata segments and insert fresh Exif + XMP + IPTC
    const fullJpegBytes = insertSegmentsIntoJpeg(jpegBytes, [app1Exif, xmpApp1, iptcApp13]);
    return new Blob([fullJpegBytes], { type: 'image/jpeg' });
  } catch (err) {
    console.error("embedMetadataInImageBlob fatal error:", err);
    return file;
  }
}

// Embed Title, Description, Keywords, 5-Star Rating, and XMP inside PNG image
export async function embedMetadataInPngBlob(
  file: File | Blob,
  metadata: Partial<StockMetadata>
): Promise<Blob> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // PNG signature is 8 bytes: 89 50 4E 47 0D 0A 1A 0A
    if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) {
      return file;
    }

    const title = (metadata.title || '').trim();
    const desc = (metadata.description || '').trim();
    const keywords = (metadata.keywords || '').trim();
    const rating = (metadata.rating !== undefined && metadata.rating > 0) ? metadata.rating : 5;
    const xmpPacket = createXmpPacket(metadata, 'image/png');

    // Also prepare raw EXIF chunk for PNG (PNG 1.5+ eXIf chunk)
    let exifChunk: Uint8Array | null = null;
    try {
      const windowsKeywords = keywords.split(',').map(k => k.trim()).filter(Boolean).join('; ');
      const zeroth: any = {};
      zeroth[piexif.ImageIFD.ImageDescription] = desc;
      zeroth[piexif.ImageIFD.XPTitle] = toUtf16Le(title);
      zeroth[piexif.ImageIFD.XPSubject] = toUtf16Le(title);
      zeroth[piexif.ImageIFD.XPKeywords] = toUtf16Le(windowsKeywords);
      zeroth[piexif.ImageIFD.Rating] = rating;
      zeroth[piexif.ImageIFD.RatingPercent] = 99;
      
      const dumped = piexif.dump({ '0th': zeroth, Exif: {}, GPS: {} });
      const rawExif = new Uint8Array(dumped.length);
      for (let i = 0; i < dumped.length; i++) {
        rawExif[i] = dumped.charCodeAt(i) & 0xff;
      }
      // PNG eXIf chunk contains the raw TIFF header. If piexif prepended 'Exif\0\0', skip those 6 bytes
      const tiffOffset = (rawExif.length >= 6 && rawExif[0] === 0x45 && rawExif[1] === 0x78) ? 6 : 0;
      exifChunk = createPngChunk('eXIf', rawExif.subarray(tiffOffset));
    } catch (e) {
      console.warn("Could not create PNG eXIf chunk:", e);
    }

    const chunksToInsert: Uint8Array[] = [
      createTextChunk('Title', title),
      createTextChunk('Description', desc),
      createTextChunk('Comment', desc),
      createTextChunk('Keywords', keywords),
      createTextChunk('Author', 'Stock Contributor'),
      createItxtChunk('XML:com.adobe.xmp', xmpPacket)
    ];

    if (exifChunk) {
      chunksToInsert.push(exifChunk);
    }

    // Find where to insert (right after IHDR chunk)
    let insertIndex = 8;
    const view = new DataView(buffer);
    let pos = 8;
    while (pos < bytes.length - 8) {
      const chunkLen = view.getUint32(pos);
      const chunkType = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
      if (chunkType === 'IHDR') {
        insertIndex = pos + 8 + chunkLen + 4;
        break;
      }
      pos += 8 + chunkLen + 4;
    }

    const totalAddedLen = chunksToInsert.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(bytes.length + totalAddedLen);
    result.set(bytes.subarray(0, insertIndex), 0);
    
    let curPos = insertIndex;
    for (const chunk of chunksToInsert) {
      result.set(chunk, curPos);
      curPos += chunk.length;
    }
    result.set(bytes.subarray(insertIndex), curPos);

    return new Blob([result], { type: 'image/png' });
  } catch (pngErr) {
    console.warn("embedMetadataInPngBlob warning, fallback to file:", pngErr);
    return file;
  }
}

// Embed Title, Description, Keywords, and XMP inside SVG XML vector
export function embedMetadataInSvg(
  svgContent: string,
  metadata: Partial<StockMetadata>
): string {
  const title = escapeXml(metadata.title || '');
  const description = escapeXml(metadata.description || '');
  const xmpPacket = createXmpPacket(metadata, 'image/svg+xml');

  const metaBlock = `
  <title>${title}</title>
  <desc>${description}</desc>
  <metadata>
${xmpPacket}
  </metadata>
`;

  let cleanSvg = svgContent
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<desc>[\s\S]*?<\/desc>/gi, '')
    .replace(/<metadata>[\s\S]*?<\/metadata>/gi, '');

  const svgTagMatch = cleanSvg.match(/<svg[^>]*>/i);
  if (svgTagMatch && svgTagMatch.index !== undefined) {
    const insertPos = svgTagMatch.index + svgTagMatch[0].length;
    return cleanSvg.slice(0, insertPos) + metaBlock + cleanSvg.slice(insertPos);
  }

  return svgContent;
}

// Helper function to search for byte sequences in Uint8Array
function findSubarray(source: Uint8Array, pattern: Uint8Array, fromIndex: number = 0): number {
  const pLen = pattern.length;
  if (pLen === 0) return -1;
  const limit = source.length - pLen;
  for (let i = fromIndex; i <= limit; i++) {
    let match = true;
    for (let j = 0; j < pLen; j++) {
      if (source[i + j] !== pattern[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

// Directly inject metadata into an EPS (PostScript) vector string
export function injectEpsMetadata(
  epsContent: string,
  metadata: Partial<StockMetadata>
): string {
  const title = (metadata.title || '').trim();
  const description = (metadata.description || title).trim();
  const keywords = (metadata.keywords || '').trim();
  const baseXml = createXmpPacket(metadata, 'application/postscript');

  // 1. Update/Inject standard Adobe PostScript DSC comments in EPS header
  let updatedEps = epsContent;
  if (/%%Title:\s*.*?\n/i.test(updatedEps)) {
    updatedEps = updatedEps.replace(/%%Title:\s*.*?\n/i, `%%Title: ${title}\n`);
  } else {
    updatedEps = updatedEps.replace(/(%!PS-Adobe[^\n]*\n)/i, `$1%%Title: ${title}\n`);
  }

  if (/%%Keywords:\s*.*?\n/i.test(updatedEps)) {
    updatedEps = updatedEps.replace(/%%Keywords:\s*.*?\n/i, `%%Keywords: ${keywords}\n`);
  } else {
    updatedEps = updatedEps.replace(/(%%Title:[^\n]*\n)/i, `$1%%Keywords: ${keywords}\n`);
  }

  if (/%%Subject:\s*.*?\n/i.test(updatedEps)) {
    updatedEps = updatedEps.replace(/%%Subject:\s*.*?\n/i, `%%Subject: ${title}\n`);
  }

  // 2. Check if EPS already contains an XMP packet
  const xpacketRegex = /<\?xpacket begin[\s\S]*?<\?xpacket end=['"][rw]['"]\?>/i;
  const match = updatedEps.match(xpacketRegex);
  if (match && match.index !== undefined) {
    const origPacket = match[0];
    const origLen = origPacket.length;
    let replacementXmp = baseXml;
    if (baseXml.length <= origLen) {
      // In-place padding: Pad with spaces before `<?xpacket end=` so total length is preserved exactly
      const padLen = origLen - baseXml.length;
      const endMarker = '<?xpacket end=';
      const insertIdx = baseXml.lastIndexOf(endMarker);
      if (insertIdx !== -1) {
        replacementXmp = baseXml.slice(0, insertIdx) + ' '.repeat(padLen) + baseXml.slice(insertIdx);
      }
    }
    return updatedEps.slice(0, match.index) + replacementXmp + updatedEps.slice(match.index + origLen);
  }

  // 3. If no existing XMP, inject PostScript ConsumeMetadata block after %%EndComments
  const endCommentsIndex = updatedEps.indexOf('%%EndComments');
  const xmpLen = new TextEncoder().encode(baseXml).length;
  const psXmlBlock = `\n%begin_xml_code\n/pdfmark where{pop true}{false}ifelse\n[/NamespacePush pdfmark\n[/_objdef {eps_metadata_stream} /type /stream /OBJ pdfmark\n[{eps_metadata_stream} 2 dict begin /Type /Metadata def /Subtype /XML def currentdict end /PUT pdfmark\n/MetadataString ${xmpLen} string def\n/TempString 100 string def\n/ConsumeMetadata {currentfile TempString readline pop pop currentfile MetadataString readstring pop pop} bind def\nConsumeMetadata\n%begin_xml_packet: ${xmpLen}\n${baseXml}\n%end_xml_packet\n[{eps_metadata_stream} MetadataString /PUT pdfmark\n%end_xml_code\n`;

  if (endCommentsIndex !== -1) {
    const insertPos = endCommentsIndex + '%%EndComments'.length;
    return updatedEps.slice(0, insertPos) + psXmlBlock + updatedEps.slice(insertPos);
  }

  return updatedEps + psXmlBlock;
}

// Binary-safe EPS/AI Metadata Embedder: Preserves DOS EPS binary headers, TIFF previews, and PostScript integrity
export async function embedMetadataInEpsBlob(
  file: File | Blob,
  metadata: Partial<StockMetadata>
): Promise<Blob> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Check for DOS EPS 30-byte header: 0xC5, 0xD0, 0xD3, 0xC6
    const isDosEps = bytes.length >= 30 &&
      bytes[0] === 0xC5 && bytes[1] === 0xD0 && bytes[2] === 0xD3 && bytes[3] === 0xC6;

    let psOffset = 0;
    let psLength = bytes.length;
    let wmfOffset = 0;
    let wmfLength = 0;
    let tiffOffset = 0;
    let tiffLength = 0;

    if (isDosEps) {
      const view = new DataView(buffer);
      psOffset = view.getUint32(4, true);
      psLength = view.getUint32(8, true);
      wmfOffset = view.getUint32(12, true);
      wmfLength = view.getUint32(16, true);
      tiffOffset = view.getUint32(20, true);
      tiffLength = view.getUint32(24, true);
    }

    if (psOffset < 0 || psLength <= 0 || psOffset + psLength > bytes.length) {
      psOffset = 0;
      psLength = bytes.length;
    }

    // Partition original file into prefix (DOS header + padding), psSlice, and suffix (e.g. TIFF preview)
    const prefixBytes = isDosEps && psOffset > 0 ? bytes.subarray(0, psOffset) : new Uint8Array(0);
    const psSlice = isDosEps && psOffset > 0 ? bytes.subarray(psOffset, psOffset + psLength) : bytes;
    const suffixBytes = isDosEps && psOffset > 0 ? bytes.subarray(psOffset + psLength) : new Uint8Array(0);

    // Search for existing XMP packet inside psSlice using byte-level search
    const startPattern = new TextEncoder().encode('<?xpacket begin');
    const xmpStart = findSubarray(psSlice, startPattern);

    const baseXml = createXmpPacket(metadata, 'application/postscript');
    let newPsBytes: Uint8Array;
    let delta = 0;

    if (xmpStart !== -1) {
      // Find end marker
      const endPattern = new TextEncoder().encode('<?xpacket end');
      const xmpEndStart = findSubarray(psSlice, endPattern, xmpStart);
      let xmpEnd = -1;
      if (xmpEndStart !== -1) {
        const closePattern = new TextEncoder().encode('?>');
        const closeIdx = findSubarray(psSlice, closePattern, xmpEndStart);
        if (closeIdx !== -1) {
          xmpEnd = closeIdx + 2;
        }
      }

      if (xmpEnd !== -1 && xmpEnd > xmpStart) {
        const origPacketLen = xmpEnd - xmpStart;
        const baseXmlBytes = new TextEncoder().encode(baseXml);

        if (baseXmlBytes.length <= origPacketLen) {
          // Standard in-place padding: Insert spaces before <?xpacket end= to match exact original length!
          const padCount = origPacketLen - baseXmlBytes.length;
          const endMarkerStr = '<?xpacket end=';
          const insIdx = baseXml.lastIndexOf(endMarkerStr);
          const paddedXml = insIdx !== -1
            ? baseXml.slice(0, insIdx) + ' '.repeat(padCount) + baseXml.slice(insIdx)
            : baseXml + ' '.repeat(padCount);
          const paddedBytes = new TextEncoder().encode(paddedXml);

          newPsBytes = new Uint8Array(psSlice.length);
          newPsBytes.set(psSlice.subarray(0, xmpStart), 0);
          newPsBytes.set(paddedBytes, xmpStart);
          newPsBytes.set(psSlice.subarray(xmpEnd), xmpStart + paddedBytes.length);
          delta = 0; // ZERO offset shift, 100% preservation!
        } else {
          // If metadata is longer than previous padding, expand cleanly
          newPsBytes = new Uint8Array(psSlice.length - origPacketLen + baseXmlBytes.length);
          newPsBytes.set(psSlice.subarray(0, xmpStart), 0);
          newPsBytes.set(baseXmlBytes, xmpStart);
          newPsBytes.set(psSlice.subarray(xmpEnd), xmpStart + baseXmlBytes.length);
          delta = baseXmlBytes.length - origPacketLen;

          // Check if %begin_xml_packet: is immediately preceding and update length
          const lookback = Math.max(0, xmpStart - 200);
          const headerBefore = new TextDecoder('latin1').decode(psSlice.subarray(lookback, xmpStart));
          const numMatch = headerBefore.match(/(%begin_xml_packet:\s*)(\d+)/i);
          if (numMatch && numMatch.index !== undefined) {
            const oldNumStr = numMatch[2];
            const newNumStr = String(baseXmlBytes.length);
            const numDiff = newNumStr.length - oldNumStr.length;
            if (numDiff === 0) {
              const fullIdx = lookback + numMatch.index + numMatch[1].length;
              newPsBytes.set(new TextEncoder().encode(newNumStr), fullIdx);
            }
          }
        }
      } else {
        // Fallback: decode text and inject safely
        const psText = new TextDecoder('latin1').decode(psSlice);
        const updatedPsText = injectEpsMetadata(psText, metadata);
        newPsBytes = new TextEncoder().encode(updatedPsText);
        delta = newPsBytes.length - psSlice.length;
      }
    } else {
      // No XMP packet in the file: inject DSC comments and Adobe PostScript XMP block
      const psText = new TextDecoder('latin1').decode(psSlice);
      const updatedPsText = injectEpsMetadata(psText, metadata);
      newPsBytes = new TextEncoder().encode(updatedPsText);
      delta = newPsBytes.length - psSlice.length;
    }

    if (!isDosEps) {
      return new Blob([newPsBytes], { type: 'application/postscript' });
    }

    // For DOS EPS: copy prefixBytes (preserving all original bytes before psOffset)
    const newPrefix = new Uint8Array(prefixBytes);
    const headerView = new DataView(newPrefix.buffer, newPrefix.byteOffset, newPrefix.byteLength);

    // Update psLength at offset 8
    headerView.setUint32(8, newPsBytes.length, true);

    // Adjust WMF offset if it appears after PostScript stream
    if (wmfOffset > psOffset && wmfLength > 0) {
      headerView.setUint32(12, wmfOffset + delta, true);
    }
    // Adjust TIFF offset if it appears after PostScript stream
    if (tiffOffset > psOffset && tiffLength > 0) {
      headerView.setUint32(20, tiffOffset + delta, true);
    }
    // Checksum = 0xFFFF per Adobe PostScript specification
    headerView.setUint16(28, 0xFFFF, true);

    return new Blob([newPrefix, newPsBytes, suffixBytes], { type: 'application/postscript' });
  } catch (epsErr) {
    console.warn("embedMetadataInEpsBlob warning, fallback to original file:", epsErr);
    return file;
  }
}

// Helper functions for MP4 Box Manipulation
function concatUint8Arrays(arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((sum, a) => sum + a.length, 0);
  const res = new Uint8Array(total);
  let offset = 0;
  for (const a of arrs) {
    res.set(a, offset);
    offset += a.length;
  }
  return res;
}

function writeMp4Box(fourCC: string, payload: Uint8Array): Uint8Array {
  const size = 8 + payload.length;
  const box = new Uint8Array(size);
  const v = new DataView(box.buffer);
  v.setUint32(0, size, false);
  for (let i = 0; i < 4; i++) {
    box[4 + i] = fourCC.charCodeAt(i);
  }
  box.set(payload, 8);
  return box;
}

function adjustMp4ChunkOffsets(buffer: Uint8Array, minOffset: number, delta: number): void {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let pos = 0;
  while (pos + 8 <= buffer.length) {
    let size = view.getUint32(pos, false);
    if (size === 0) size = buffer.length - pos;
    if (size < 8 || pos + size > buffer.length) break;

    const type = String.fromCharCode(
      buffer[pos + 4],
      buffer[pos + 5],
      buffer[pos + 6],
      buffer[pos + 7]
    );

    if (type === 'stco') {
      const entryCount = view.getUint32(pos + 12, false);
      let entryPos = pos + 16;
      for (let i = 0; i < entryCount; i++) {
        if (entryPos + 4 > buffer.length) break;
        const currentOffset = view.getUint32(entryPos, false);
        if (currentOffset >= minOffset) {
          view.setUint32(entryPos, currentOffset + delta, false);
        }
        entryPos += 4;
      }
    } else if (type === 'co64') {
      const entryCount = view.getUint32(pos + 12, false);
      let entryPos = pos + 16;
      for (let i = 0; i < entryCount; i++) {
        if (entryPos + 8 > buffer.length) break;
        const currentOffset = view.getBigUint64(entryPos, false);
        if (currentOffset >= BigInt(minOffset)) {
          view.setBigUint64(entryPos, currentOffset + BigInt(delta), false);
        }
        entryPos += 8;
      }
    } else if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) {
      adjustMp4ChunkOffsets(buffer.subarray(pos + 8, pos + size), minOffset, delta);
    }
    pos += size;
  }
}

async function findMp4Boxes(file: File): Promise<{
  moovOffset: number;
  moovSize: number;
  mdatOffset: number;
  nextAfterMoovType: string;
  nextAfterMoovSize: number;
  nextAfterMoovOffset: number;
}> {
  let offset = 0;
  const fileSize = file.size;
  let moovOffset = -1;
  let moovSize = 0;
  let mdatOffset = -1;
  let nextAfterMoovType = '';
  let nextAfterMoovSize = 0;
  let nextAfterMoovOffset = 0;

  while (offset + 8 <= fileSize) {
    const headerBlob = file.slice(offset, offset + 16);
    const headerBuf = await headerBlob.arrayBuffer();
    const view = new DataView(headerBuf);
    let size = view.getUint32(0, false);
    const type = String.fromCharCode(
      view.getUint8(4),
      view.getUint8(5),
      view.getUint8(6),
      view.getUint8(7)
    );

    if (size === 1) {
      if (headerBuf.byteLength >= 16) {
        size = Number(view.getBigUint64(8, false));
      }
    } else if (size === 0) {
      size = fileSize - offset;
    }

    if (type === 'moov') {
      moovOffset = offset;
      moovSize = size;
      const nextOffset = offset + size;
      if (nextOffset + 8 <= fileSize) {
        try {
          const nextHeaderBlob = file.slice(nextOffset, nextOffset + 8);
          const nextHeaderBuf = await nextHeaderBlob.arrayBuffer();
          const nextView = new DataView(nextHeaderBuf);
          nextAfterMoovSize = nextView.getUint32(0, false);
          nextAfterMoovType = String.fromCharCode(
            nextView.getUint8(4),
            nextView.getUint8(5),
            nextView.getUint8(6),
            nextView.getUint8(7)
          );
          nextAfterMoovOffset = nextOffset;
        } catch (e) {}
      }
    } else if (type === 'mdat') {
      mdatOffset = offset;
    }

    if (size <= 0) break;
    offset += size;
  }

  return { moovOffset, moovSize, mdatOffset, nextAfterMoovType, nextAfterMoovSize, nextAfterMoovOffset };
}

function buildXtraBox(
  title: string,
  description: string,
  tags: string,
  keywordsList: string[],
  rating: number
): Uint8Array {
  // Windows Explorer 5-star rating:
  // 1 star = 1, 2 stars = 25, 3 stars = 50, 4 stars = 75, 5 stars = 99 (standard Windows Shell / WMF)
  const ratingPercent = rating >= 5 ? 99 : (rating === 4 ? 75 : (rating === 3 ? 50 : (rating === 2 ? 25 : 1)));

  function createXtraUnicodeEntry(tagName: string, value: string): Uint8Array {
    const enc = new TextEncoder();
    const tagBytes = enc.encode(tagName);
    const tagLen = tagBytes.length;

    // Value data: UTF-16LE + 2 null bytes (0x00, 0x00)
    const utf16Bytes = new Uint8Array((value.length + 1) * 2);
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      utf16Bytes[i * 2] = code & 0xff;
      utf16Bytes[i * 2 + 1] = (code >> 8) & 0xff;
    }

    const valType = 8; // Unicode
    const recordLen = utf16Bytes.length + 6;
    const count = 1;

    // valBuff: count (4 bytes BE) + recordLen (4 bytes BE) + valType (2 bytes BE) + utf16Bytes
    const valBuff = new Uint8Array(4 + 4 + 2 + utf16Bytes.length);
    const dv = new DataView(valBuff.buffer);
    dv.setUint32(0, count, false); // Big Endian
    dv.setUint32(4, recordLen, false); // Big Endian
    dv.setUint16(8, valType, false); // Big Endian (0x0008) - CRITICAL for Windows Explorer!
    valBuff.set(utf16Bytes, 10);

    const entrySize = 4 + 4 + tagLen + valBuff.length;
    const entry = new Uint8Array(entrySize);
    const edv = new DataView(entry.buffer);
    edv.setUint32(0, entrySize, false);
    edv.setUint32(4, tagLen, false);
    entry.set(tagBytes, 8);
    entry.set(valBuff, 8 + tagLen);

    return entry;
  }

  function createXtraMultiUnicodeEntry(tagName: string, values: string[]): Uint8Array {
    const enc = new TextEncoder();
    const tagBytes = enc.encode(tagName);
    const tagLen = tagBytes.length;

    const records: Uint8Array[] = [];
    for (const value of values) {
      const utf16Bytes = new Uint8Array((value.length + 1) * 2);
      for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        utf16Bytes[i * 2] = code & 0xff;
        utf16Bytes[i * 2 + 1] = (code >> 8) & 0xff;
      }
      const record = new Uint8Array(4 + 2 + utf16Bytes.length);
      const rdv = new DataView(record.buffer);
      rdv.setUint32(0, utf16Bytes.length + 6, false); // recordLen BE
      rdv.setUint16(4, 8, false); // valType = 8 BE
      record.set(utf16Bytes, 6);
      records.push(record);
    }

    let recordsLen = 0;
    for (const r of records) recordsLen += r.length;

    const valBuff = new Uint8Array(4 + recordsLen);
    const vdv = new DataView(valBuff.buffer);
    vdv.setUint32(0, values.length, false); // count BE
    let pos = 4;
    for (const r of records) {
      valBuff.set(r, pos);
      pos += r.length;
    }

    const entrySize = 4 + 4 + tagLen + valBuff.length;
    const entry = new Uint8Array(entrySize);
    const edv = new DataView(entry.buffer);
    edv.setUint32(0, entrySize, false);
    edv.setUint32(4, tagLen, false);
    entry.set(tagBytes, 8);
    entry.set(valBuff, 8 + tagLen);

    return entry;
  }

  function createXtraInt64Entry(tagName: string, numVal: number): Uint8Array {
    const enc = new TextEncoder();
    const tagBytes = enc.encode(tagName);
    const tagLen = tagBytes.length;

    const valBytes = new Uint8Array(8);
    const bdv = new DataView(valBytes.buffer);
    bdv.setUint32(0, numVal >>> 0, true);
    bdv.setUint32(4, 0, true);

    const valType = 19; // int64u
    const recordLen = 8 + 6; // 14
    const count = 1;

    const valBuff = new Uint8Array(4 + 4 + 2 + 8);
    const dv = new DataView(valBuff.buffer);
    dv.setUint32(0, count, false);
    dv.setUint32(4, recordLen, false);
    dv.setUint16(8, valType, false); // Big Endian (0x0013) - CRITICAL for Windows Explorer!
    valBuff.set(valBytes, 10);

    const entrySize = 4 + 4 + tagLen + valBuff.length;
    const entry = new Uint8Array(entrySize);
    const edv = new DataView(entry.buffer);
    edv.setUint32(0, entrySize, false);
    edv.setUint32(4, tagLen, false);
    entry.set(tagBytes, 8);
    entry.set(valBuff, 8 + tagLen);

    return entry;
  }

  const entries: Uint8Array[] = [];
  if (title) {
    entries.push(createXtraUnicodeEntry('Title', title));
    entries.push(createXtraUnicodeEntry('WM/SubTitle', title));
    entries.push(createXtraUnicodeEntry('{F29F85E0-4FF9-1068-AB91-08002B27B3D9} 2', title));
  }
  if (description) {
    entries.push(createXtraUnicodeEntry('Description', description));
    entries.push(createXtraUnicodeEntry('Comment', description));
    entries.push(createXtraUnicodeEntry('{F29F85E0-4FF9-1068-AB91-08002B27B3D9} 6', description));
  }
  if (keywordsList.length > 0) {
    // Multi-value list for Windows Explorer native tag collection
    entries.push(createXtraMultiUnicodeEntry('WM/Category', keywordsList));
    entries.push(createXtraMultiUnicodeEntry('{F29F85E0-4FF9-1068-AB91-08002B27B3D9} 5', keywordsList));
    if (tags) {
      // Semicolon-delimited string fallback
      entries.push(createXtraUnicodeEntry('Keywords', tags));
      entries.push(createXtraUnicodeEntry('Tags', tags));
      entries.push(createXtraUnicodeEntry('{D5CDD502-2E9C-101B-9397-08002B2CF9AE} 2', tags));
    }
  } else if (tags) {
    entries.push(createXtraUnicodeEntry('WM/Category', tags));
    entries.push(createXtraUnicodeEntry('Keywords', tags));
    entries.push(createXtraUnicodeEntry('Tags', tags));
  }

  // Windows Explorer 5-star rating (99 = 5 stars)
  entries.push(createXtraInt64Entry('WM/SharedUserRating', ratingPercent));
  entries.push(createXtraInt64Entry('Rating', ratingPercent));
  entries.push(createXtraInt64Entry('UserRating', ratingPercent));
  entries.push(createXtraInt64Entry('{64440492-4C8B-11D1-8B70-080036B11A03} 9', ratingPercent));

  entries.push(createXtraUnicodeEntry('Author', 'Stock Contributor'));
  entries.push(createXtraUnicodeEntry('WM/Composer', 'Stock Contributor'));
  entries.push(createXtraUnicodeEntry('{F29F85E0-4FF9-1068-AB91-08002B27B3D9} 4', 'Stock Contributor'));
  entries.push(createXtraUnicodeEntry('WM/Year', String(new Date().getFullYear())));

  return writeMp4Box('Xtra', concatUint8Arrays(entries));
}

function createMp4Udta(metadata: Partial<StockMetadata>): Uint8Array {
  const title = (metadata.title || '').trim();
  const description = (metadata.description || '').trim();
  const rawKeywords = (metadata.keywords || '').trim();
  const keywordsList = rawKeywords
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
  const windowsTags = keywordsList.join('; ');
  const rating = (metadata.rating !== undefined && metadata.rating > 0) ? metadata.rating : 5;

  const enc = new TextEncoder();

  function writeDataBox(text: string): Uint8Array {
    const textBytes = enc.encode(text);
    const payload = new Uint8Array(8 + textBytes.length);
    const v = new DataView(payload.buffer);
    v.setUint32(0, 1, false); // type 1: UTF-8 text
    v.setUint32(4, 0, false); // locale 0
    payload.set(textBytes, 8);
    return writeMp4Box('data', payload);
  }

  function writeIntDataBox(val: number): Uint8Array {
    const payload = new Uint8Array(9);
    const v = new DataView(payload.buffer);
    v.setUint32(0, 21, false); // type 21: integer
    v.setUint32(4, 0, false);
    payload[8] = val & 0xff;
    return writeMp4Box('data', payload);
  }

  // Helper to write Apple iTunes / Windows Explorer custom '----' atom
  // with sub-boxes 'mean' (reverse DNS domain), 'name' (property name), and 'data'
  function writeCustomAtom(mean: string, name: string, valueText: string): Uint8Array {
    const meanText = enc.encode(mean);
    const meanPayload = new Uint8Array(4 + meanText.length);
    meanPayload.set(meanText, 4);
    const meanBox = writeMp4Box('mean', meanPayload);

    const nameText = enc.encode(name);
    const namePayload = new Uint8Array(4 + nameText.length);
    namePayload.set(nameText, 4);
    const nameBox = writeMp4Box('name', namePayload);

    const dataBox = writeDataBox(valueText);

    const customPayload = new Uint8Array(meanBox.length + nameBox.length + dataBox.length);
    customPayload.set(meanBox, 0);
    customPayload.set(nameBox, meanBox.length);
    customPayload.set(dataBox, meanBox.length + nameBox.length);

    return writeMp4Box('----', customPayload);
  }

  // 1. iTunes ilst items (Windows Explorer, QuickTime, VLC, Adobe Premiere)
  const ilstItems: Uint8Array[] = [];

  // Title: ©nam
  if (title) {
    ilstItems.push(writeMp4Box('\xa9nam', writeDataBox(title)));
    ilstItems.push(writeCustomAtom('com.apple.iTunes', 'Title', title));
  }

  // Subtitle / Description: ©des and desc
  if (description) {
    ilstItems.push(writeMp4Box('\xa9des', writeDataBox(description)));
    ilstItems.push(writeMp4Box('desc', writeDataBox(description)));
    ilstItems.push(writeCustomAtom('com.apple.iTunes', 'Description', description));
  }

  // Keywords / Tags: keyw, ©gen, and custom iTunes/Windows Keywords atom
  if (windowsTags) {
    ilstItems.push(writeMp4Box('keyw', writeDataBox(windowsTags)));
    ilstItems.push(writeMp4Box('\xa9gen', writeDataBox(keywordsList.slice(0, 5).join(', '))));
    ilstItems.push(writeCustomAtom('com.apple.iTunes', 'Keywords', windowsTags));
    ilstItems.push(writeCustomAtom('com.apple.iTunes', 'Tags', windowsTags));
  }

  // Comments: ©cmt
  if (description) {
    ilstItems.push(writeMp4Box('\xa9cmt', writeDataBox(description)));
  }

  // Rating: rate, rtng, and Windows Explorer MP4 Property Handler atoms (WM/SharedUserRating = 99 for 5 stars)
  const ratingPercent = rating >= 5 ? 99 : (rating === 4 ? 75 : (rating === 3 ? 50 : (rating === 2 ? 25 : 1)));
  ilstItems.push(writeMp4Box('rate', writeDataBox(String(rating))));
  ilstItems.push(writeMp4Box('rtng', writeIntDataBox(rating)));
  ilstItems.push(writeCustomAtom('com.apple.iTunes', 'rate', String(rating)));
  ilstItems.push(writeCustomAtom('com.apple.iTunes', 'Rating', String(rating)));
  ilstItems.push(writeCustomAtom('com.apple.iTunes', 'WM/SharedUserRating', String(ratingPercent)));
  ilstItems.push(writeCustomAtom('com.apple.iTunes', 'rating', String(ratingPercent)));

  // Year: ©day
  ilstItems.push(writeMp4Box('\xa9day', writeDataBox(String(new Date().getFullYear()))));

  // Author / Artist: ©art, ©wrt, cprt
  ilstItems.push(writeMp4Box('\xa9art', writeDataBox('Stock Contributor')));
  ilstItems.push(writeMp4Box('\xa9wrt', writeDataBox('Stock Contributor')));
  ilstItems.push(writeMp4Box('cprt', writeDataBox('Copyright Stock Contributor')));
  ilstItems.push(writeCustomAtom('com.apple.iTunes', 'Author', 'Stock Contributor'));

  // Assemble 'ilst' box
  const ilstPayload = concatUint8Arrays(ilstItems);
  const ilstBox = writeMp4Box('ilst', ilstPayload);

  // Build 'hdlr' for 'meta'
  const hdlrPayload = new Uint8Array(25);
  // 'mdir'
  hdlrPayload[8] = 0x6d; hdlrPayload[9] = 0x64; hdlrPayload[10] = 0x69; hdlrPayload[11] = 0x72;
  // 'appl'
  hdlrPayload[12] = 0x61; hdlrPayload[13] = 0x70; hdlrPayload[14] = 0x70; hdlrPayload[15] = 0x6c;
  const hdlrBox = writeMp4Box('hdlr', hdlrPayload);

  // Build 'meta' FullBox (version 0, flags 0)
  const metaPayload = concatUint8Arrays([new Uint8Array(4), hdlrBox, ilstBox]);
  const metaBox = writeMp4Box('meta', metaPayload);

  // 2. Microsoft Windows Explorer 'Xtra' atom with rating, tags, title, description
  const xtraBox = buildXtraBox(title, description, windowsTags, keywordsList, rating);

  const udtaParts: Uint8Array[] = [metaBox, xtraBox];

  // 3. 3GPP metadata boxes (directly read by Windows Explorer Properties -> Details tab)
  if (title) {
    const tBytes = enc.encode(title);
    const titlPayload = new Uint8Array(4 + 2 + tBytes.length + 1);
    const tv = new DataView(titlPayload.buffer);
    tv.setUint16(4, 0x15c7, false); // 'eng'
    titlPayload.set(tBytes, 6);
    titlPayload[titlPayload.length - 1] = 0;
    udtaParts.push(writeMp4Box('titl', titlPayload));
  }

  if (description) {
    const dBytes = enc.encode(description);
    const dscpPayload = new Uint8Array(4 + 2 + dBytes.length + 1);
    const dv = new DataView(dscpPayload.buffer);
    dv.setUint16(4, 0x15c7, false);
    dscpPayload.set(dBytes, 6);
    dscpPayload[dscpPayload.length - 1] = 0;
    udtaParts.push(writeMp4Box('dscp', dscpPayload));
  }

  if (keywordsList.length > 0) {
    const validKeywords = keywordsList.slice(0, 50);
    let totalLen = 0;
    const encodedKws: Uint8Array[] = [];
    for (const kw of validKeywords) {
      const b = enc.encode(kw);
      encodedKws.push(b);
      totalLen += 1 + b.length;
    }
    const kywdPayload = new Uint8Array(4 + 2 + 1 + totalLen);
    const kv = new DataView(kywdPayload.buffer);
    kv.setUint16(4, 0x15c7, false);
    kywdPayload[6] = validKeywords.length;
    let kPos = 7;
    for (const b of encodedKws) {
      kywdPayload[kPos] = b.length;
      kywdPayload.set(b, kPos + 1);
      kPos += 1 + b.length;
    }
    udtaParts.push(writeMp4Box('kywd', kywdPayload));
  }

  // 4. Adobe XMP packets directly in udta (for Adobe Premiere, Bridge, Stock agencies, Windows 10/11)
  const xmpString = createXmpPacket(metadata, 'video/mp4');
  const xmpBytes = enc.encode(xmpString);

  // 'XMP_' box
  udtaParts.push(writeMp4Box('XMP_', xmpBytes));

  // 'uuid' box (Adobe XMP GUID: BE 7A CF CB 97 A9 42 E8 9C 71 99 94 91 E3 AF AC)
  const xmpUuid = new Uint8Array([
    0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8,
    0x9c, 0x71, 0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac
  ]);
  udtaParts.push(writeMp4Box('uuid', concatUint8Arrays([xmpUuid, xmpBytes])));

  return writeMp4Box('udta', concatUint8Arrays(udtaParts));
}

// Direct Video (MP4, MOV, M4V) Metadata Embedder
export async function embedMetadataInMp4Blob(
  file: File,
  metadata: Partial<StockMetadata>
): Promise<Blob> {
  try {
    const { moovOffset, moovSize, mdatOffset, nextAfterMoovType, nextAfterMoovSize, nextAfterMoovOffset } =
      await findMp4Boxes(file);

    if (moovOffset === -1 || moovSize <= 8) {
      console.warn("Could not find moov atom in MP4/MOV, returning original file");
      return file;
    }

    // Read existing moov box
    const moovBlob = file.slice(moovOffset, moovOffset + moovSize);
    const moovArrayBuf = await moovBlob.arrayBuffer();
    const oldMoovBytes = new Uint8Array(moovArrayBuf);
    const oldMoovView = new DataView(oldMoovBytes.buffer);

    // Extract sub-boxes of moov, excluding any old udta
    const subBoxes: Uint8Array[] = [];
    let pos = 8;
    while (pos + 8 <= oldMoovBytes.length) {
      let size = oldMoovView.getUint32(pos, false);
      if (size === 0) size = oldMoovBytes.length - pos;
      if (size < 8 || pos + size > oldMoovBytes.length) break;

      const type = String.fromCharCode(
        oldMoovBytes[pos + 4],
        oldMoovBytes[pos + 5],
        oldMoovBytes[pos + 6],
        oldMoovBytes[pos + 7]
      );

      if (type !== 'udta' && type !== 'Xtra') {
        subBoxes.push(oldMoovBytes.slice(pos, pos + size));
      }
      pos += size;
    }

    // Create our new rich udta box
    const newUdtaBox = createMp4Udta(metadata);
    subBoxes.push(newUdtaBox);

    // Also include Xtra directly under moov for tools / Windows handlers that inspect moov/Xtra
    const rawKeywords = (metadata.keywords || '').trim();
    const keywordsList = rawKeywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);
    const windowsTags = keywordsList.join('; ');
    const rating = (metadata.rating !== undefined && metadata.rating > 0) ? metadata.rating : 5;
    const directXtraBox = buildXtraBox(
      (metadata.title || '').trim(),
      (metadata.description || '').trim(),
      windowsTags,
      keywordsList,
      rating
    );
    subBoxes.push(directXtraBox);

    // Assemble new moov
    const totalSubBoxesLength = subBoxes.reduce((sum, b) => sum + b.length, 0);
    const newMoovBytes = new Uint8Array(8 + totalSubBoxesLength);
    const newMoovView = new DataView(newMoovBytes.buffer);
    newMoovView.setUint32(0, newMoovBytes.length, false);
    newMoovBytes[4] = 0x6d; // 'm'
    newMoovBytes[5] = 0x6f; // 'o'
    newMoovBytes[6] = 0x6f; // 'o'
    newMoovBytes[7] = 0x76; // 'v'

    let curOffset = 8;
    for (const b of subBoxes) {
      newMoovBytes.set(b, curOffset);
      curOffset += b.length;
    }

    const delta = newMoovBytes.length - moovSize;

    // Check if there is a 'free' box immediately after moov that can absorb delta
    if (delta > 0 && nextAfterMoovType === 'free' && nextAfterMoovSize >= delta + 8) {
      const newFreeSize = nextAfterMoovSize - delta;
      const newFreeHeader = new Uint8Array(8);
      const fhView = new DataView(newFreeHeader.buffer);
      fhView.setUint32(0, newFreeSize, false);
      newFreeHeader[4] = 0x66; newFreeHeader[5] = 0x72; newFreeHeader[6] = 0x65; newFreeHeader[7] = 0x65; // 'free'
      
      const beforeMoov = file.slice(0, moovOffset);
      const remainingFreeData = file.slice(nextAfterMoovOffset + 8 + delta, nextAfterMoovOffset + nextAfterMoovSize);
      const afterFree = file.slice(nextAfterMoovOffset + nextAfterMoovSize);

      return new Blob(
        [beforeMoov, newMoovBytes, newFreeHeader, remainingFreeData, afterFree],
        { type: file.type || 'video/mp4' }
      );
    }

    // If moov is located before mdat and delta !== 0, adjust chunk offsets (stco and co64)
    if (delta !== 0 && mdatOffset > moovOffset) {
      adjustMp4ChunkOffsets(newMoovBytes, moovOffset + moovSize, delta);
    }

    // Construct final Blob using file slices (instant, zero copying of huge video data!)
    const beforeMoov = file.slice(0, moovOffset);
    const afterMoov = file.slice(moovOffset + moovSize);

    return new Blob([beforeMoov, newMoovBytes, afterMoov], { type: file.type || 'video/mp4' });
  } catch (err) {
    console.error("Failed to embed MP4 metadata:", err);
    return file;
  }
}

// Unified processor: Takes any file format and returns embedded binary Blob
export async function prepareEmbeddedBlob(
  file: File | Blob,
  metadata: Partial<StockMetadata>
): Promise<Blob> {
  try {
    const filename = metadata.filename || (file instanceof File ? file.name : 'asset.jpg');
    const ext = (metadata.fileType || filename.split('.').pop() || '').toLowerCase();

    if (['jpg', 'jpeg'].includes(ext)) {
      return await embedMetadataInImageBlob(file, metadata);
    }
    if (['png'].includes(ext)) {
      return await embedMetadataInPngBlob(file, metadata);
    }
    if (['eps', 'ai'].includes(ext)) {
      return await embedMetadataInEpsBlob(file, metadata);
    }
    if (['svg'].includes(ext)) {
      const text = await file.text();
      const updated = embedMetadataInSvg(text, metadata);
      return new Blob([updated], { type: 'image/svg+xml' });
    }
    if (['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm', 'wmv'].includes(ext)) {
      return await embedMetadataInMp4Blob(file as File, metadata);
    }
    // Other binary formats
    return file;
  } catch (err) {
    console.error("prepareEmbeddedBlob error:", err);
    return file;
  }
}

// Generate Adobe Photoshop JSX ExtendScript for Batch Renaming & Metadata Embedding
export function generatePhotoshopScript(files: StockMetadata[]): string {
  const itemsData = files.map(f => ({
    originalFilename: f.originalFilename || f.filename,
    newFilename: f.filename,
    title: f.title || '',
    description: f.description || '',
    keywords: (f.keywords || '')
      .split(',')
      .map(k => k.trim())
      .filter(Boolean),
    rating: f.rating || 5
  }));

  return `/* Adobe Photoshop Automated Metadata Embed & File Renamer */
#target photoshop
app.bringToFront();

(function() {
  var fileData = ${JSON.stringify(itemsData, null, 2)};

  var folder = Folder.selectDialog("Select the folder containing your original image files:");
  if (!folder) {
    alert("Operation cancelled. No folder selected.");
    return;
  }

  var processedCount = 0;
  var errorList = [];

  for (var i = 0; i < fileData.length; i++) {
    var item = fileData[i];
    
    // Check original filename first, then new filename
    var targetFile = new File(folder + "/" + item.originalFilename);
    if (!targetFile.exists) {
      targetFile = new File(folder + "/" + item.newFilename);
    }

    if (!targetFile.exists) {
      errorList.push(item.originalFilename + " (File not found in selected folder)");
      continue;
    }

    try {
      var doc = app.open(targetFile);

      // Set Document File Info (IPTC / XMP metadata)
      doc.info.title = item.title;
      doc.info.headline = item.title;
      doc.info.caption = item.description;
      doc.info.keywords = item.keywords;
      doc.info.credit = "Stock Contributor";
      doc.info.author = "Stock Contributor";

      // Save to new renamed filename in the exact same folder
      var destinationFile = new File(folder + "/" + item.newFilename);
      var ext = item.newFilename.split('.').pop().toLowerCase();

      if (ext === "jpg" || ext === "jpeg") {
        var jpgOptions = new JPEGSaveOptions();
        jpgOptions.quality = 12;
        jpgOptions.embedColorProfile = true;
        doc.saveAs(destinationFile, jpgOptions, true, Extension.LOWERCASE);
      } else if (ext === "png") {
        var pngOptions = new PNGSaveOptions();
        pngOptions.compression = 1;
        doc.saveAs(destinationFile, pngOptions, true, Extension.LOWERCASE);
      } else {
        doc.save();
      }

      doc.close(SaveOptions.DONOTSAVECHANGES);

      // Remove the old unrenamed file if the filename was changed
      if (targetFile.fsName !== destinationFile.fsName && targetFile.exists) {
        try {
          targetFile.remove();
        } catch(e) {}
      }

      processedCount++;
    } catch (err) {
      errorList.push(item.originalFilename + " (" + err.message + ")");
    }
  }

  var msg = "PHOTOSHOP AUTOMATION COMPLETE!\\n\\n";
  msg += "Successfully Embedded & Renamed: " + processedCount + " files.\\n";
  if (errorList.length > 0) {
    msg += "\\nWarnings/Errors (" + errorList.length + "):\\n" + errorList.slice(0, 5).join("\\n");
    if (errorList.length > 5) msg += "\\n...and " + (errorList.length - 5) + " more.";
  }
  alert(msg);
})();
`;
}

// Generate Adobe Illustrator JSX ExtendScript for Batch Renaming & Metadata Embedding in EPS/AI
export function generateIllustratorScript(files: StockMetadata[]): string {
  const itemsData = files.map(f => ({
    originalFilename: f.originalFilename || f.filename,
    newFilename: f.filename,
    title: f.title || '',
    description: f.description || '',
    keywords: (f.keywords || '')
      .split(',')
      .map(k => k.trim())
      .filter(Boolean),
    rating: f.rating || 5
  }));

  return `/* Adobe Illustrator Automated EPS/Vector Metadata Embed & File Renamer */
#target illustrator

(function() {
  var fileData = ${JSON.stringify(itemsData, null, 2)};

  var folder = Folder.selectDialog("Select the folder containing your original EPS vector files:");
  if (!folder) {
    alert("Operation cancelled. No folder selected.");
    return;
  }

  if (ExternalObject.AdobeXMPScript == undefined) {
    ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
  }

  var processedCount = 0;
  var errorList = [];

  for (var i = 0; i < fileData.length; i++) {
    var item = fileData[i];
    
    var targetFile = new File(folder + "/" + item.originalFilename);
    if (!targetFile.exists) {
      targetFile = new File(folder + "/" + item.newFilename);
    }

    if (!targetFile.exists) {
      errorList.push(item.originalFilename + " (File not found)");
      continue;
    }

    try {
      var doc = app.open(targetFile);

      // Embed XMP metadata
      var xmp = new XMPMeta(doc.XMPString);
      xmp.deleteProperty(XMPConst.NS_DC, "title");
      xmp.appendArrayItem(XMPConst.NS_DC, "title", item.title, 0, XMPConst.ALIAS_TO_ALT_TEXT);
      xmp.setQualifier(XMPConst.NS_DC, "title[1]", "xml:lang", "x-default");

      xmp.deleteProperty(XMPConst.NS_DC, "description");
      xmp.appendArrayItem(XMPConst.NS_DC, "description", item.description, 0, XMPConst.ALIAS_TO_ALT_TEXT);
      xmp.setQualifier(XMPConst.NS_DC, "description[1]", "xml:lang", "x-default");

      xmp.deleteProperty(XMPConst.NS_DC, "subject");
      for (var k = 0; k < item.keywords.length; k++) {
        xmp.appendArrayItem(XMPConst.NS_DC, "subject", item.keywords[k], 0, XMPConst.PROP_VALUE_IS_ARRAY);
      }

      xmp.setProperty(XMPConst.NS_XMP, "Rating", item.rating || 5);
      xmp.setProperty(XMPConst.NS_PHOTOSHOP, "Headline", item.title);

      doc.XMPString = xmp.serialize();

      // Save as renamed EPS in the same directory
      var destinationFile = new File(folder + "/" + item.newFilename);
      var epsSaveOpts = new EPSSaveOptions();
      epsSaveOpts.saveMultipleArtboards = false;
      epsSaveOpts.compatibility = Compatibility.ILLUSTRATOR10; // Stock standard EPS10
      doc.saveAs(destinationFile, epsSaveOpts);
      doc.close(SaveOptions.DONOTSAVECHANGES);

      // Remove unrenamed original if the name changed
      if (targetFile.fsName !== destinationFile.fsName && targetFile.exists) {
        try {
          targetFile.remove();
        } catch(e) {}
      }

      processedCount++;
    } catch (err) {
      errorList.push(item.originalFilename + " (" + err.message + ")");
    }
  }

  var msg = "ADOBE ILLUSTRATOR AUTOMATION COMPLETE!\\n\\n";
  msg += "Successfully Embedded & Renamed: " + processedCount + " EPS files.\\n";
  if (errorList.length > 0) {
    msg += "\\nWarnings/Errors (" + errorList.length + "):\\n" + errorList.slice(0, 5).join("\\n");
    if (errorList.length > 5) msg += "\\n...and " + (errorList.length - 5) + " more.";
  }
  alert(msg);
})();
`;
}
