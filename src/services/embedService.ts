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

// Embed EXIF + IPTC + XMP into JPEG Image Blob (Rock-Solid for Windows, Photoshop & Stock agencies)
export async function embedMetadataInImageBlob(
  file: File,
  metadata: Partial<StockMetadata>
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target?.result as string;
        let zeroth: any = {};
        let exif: any = {};

        try {
          const existingExif = piexif.load(base64);
          if (existingExif['0th']) zeroth = existingExif['0th'];
          if (existingExif['Exif']) exif = existingExif['Exif'];
        } catch {
          // If no previous exif, initialize cleanly
        }

        const title = (metadata.title || '').trim();
        const description = (metadata.description || '').trim();
        const rawKeywords = (metadata.keywords || '').trim();
        // Windows Explorer requires semicolons between keywords in XPKeywords
        const windowsKeywords = rawKeywords
          .split(',')
          .map(k => k.trim())
          .filter(Boolean)
          .join('; ');
        const rating = (metadata.rating !== undefined && metadata.rating > 0) ? metadata.rating : 5;

        // 1. Standard Exif IFD tags (Windows Explorer Properties -> Details)
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

        const exifObj = { '0th': zeroth, Exif: exif, GPS: {} };
        const exifBytes = piexif.dump(exifObj);
        const withExifBase64 = piexif.insert(exifBytes, base64);

        // Convert base64 to binary byte array
        const binaryStr = atob(withExifBase64.split(',')[1]);
        const jpegBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          jpegBytes[i] = binaryStr.charCodeAt(i);
        }

        // 2. Standard Adobe XMP APP1 Packet (Photoshop, Bridge, Lightroom, Stock agencies)
        const xmpString = createXmpPacket(metadata, 'image/jpeg');
        const xmpApp1 = createXmpApp1Block(xmpString);

        // 3. Standard Adobe Photoshop 3.0 APP13 IPTC Block (IIM Record 2)
        const iptcApp13 = createIptcApp13Block(title, description, rawKeywords, metadata.category);

        // 4. Inject both XMP & IPTC into the JPEG
        const fullJpegBytes = insertSegmentsIntoJpeg(jpegBytes, [xmpApp1, iptcApp13]);

        const finalBlob = new Blob([fullJpegBytes], { type: 'image/jpeg' });
        resolve(finalBlob);
      } catch (err) {
        console.error("Failed to embed JPEG metadata:", err);
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Embed Title, Description, Keywords, 5-Star Rating, and XMP inside PNG image
export async function embedMetadataInPngBlob(
  file: File,
  metadata: Partial<StockMetadata>
): Promise<Blob> {
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
    // In piexif, dumped string starts with 'Exif\0\0' followed by TIFF header (8 bytes)
    // The eXIf chunk in PNG requires the TIFF header without the 'Exif\0\0' 6-byte prefix
    const binary = atob(dumped.split(',')[1] || dumped);
    const rawExif = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) rawExif[i] = binary.charCodeAt(i);
    const tiffOffset = (rawExif[0] === 0x45 && rawExif[1] === 0x78) ? 6 : 0;
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

// Directly inject metadata into an EPS (PostScript) vector string
export function injectEpsMetadata(
  epsContent: string,
  metadata: Partial<StockMetadata>
): string {
  const title = metadata.title || '';
  const description = metadata.description || '';
  const keywords = metadata.keywords || '';
  const xmpPacket = createXmpPacket(metadata, 'application/postscript');

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
  const xpacketRegex = /<\?xpacket begin[\s\S]*?<\?xpacket end="[rw]"\?>/g;
  if (xpacketRegex.test(updatedEps)) {
    return updatedEps.replace(xpacketRegex, xmpPacket);
  }

  // Look for %%EndComments marker in PostScript EPS header
  const endCommentsIndex = updatedEps.indexOf('%%EndComments');
  if (endCommentsIndex !== -1) {
    const insertPos = endCommentsIndex + '%%EndComments'.length;
    return (
      updatedEps.slice(0, insertPos) +
      '\n%begin_xml_code\n' +
      xmpPacket +
      '\n%end_xml_code\n' +
      updatedEps.slice(insertPos)
    );
  }

  // If no %%EndComments, insert right after the first line (e.g., %!PS-Adobe-3.0 EPSF-3.0)
  const firstNewline = updatedEps.indexOf('\n');
  if (firstNewline !== -1) {
    return (
      updatedEps.slice(0, firstNewline + 1) +
      '%begin_xml_code\n' +
      xmpPacket +
      '\n%end_xml_code\n' +
      updatedEps.slice(firstNewline + 1)
    );
  }

  return '%begin_xml_code\n' + xmpPacket + '\n%end_xml_code\n' + updatedEps;
}

// Unified processor: Takes any file format and returns embedded binary Blob
export async function prepareEmbeddedBlob(
  file: File,
  metadata: Partial<StockMetadata>
): Promise<Blob> {
  const ext = (metadata.filename || file.name).split('.').pop()?.toLowerCase() || '';

  if (['jpg', 'jpeg'].includes(ext)) {
    return await embedMetadataInImageBlob(file, metadata);
  }
  if (['png'].includes(ext)) {
    return await embedMetadataInPngBlob(file, metadata);
  }
  if (['eps', 'ai'].includes(ext)) {
    const text = await file.text();
    const updated = injectEpsMetadata(text, metadata);
    return new Blob([updated], { type: 'application/postscript' });
  }
  if (['svg'].includes(ext)) {
    const text = await file.text();
    const updated = embedMetadataInSvg(text, metadata);
    return new Blob([updated], { type: 'image/svg+xml' });
  }
  // For video (mp4, mov, avi) and others:
  // Return the original file binary
  return file;
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
