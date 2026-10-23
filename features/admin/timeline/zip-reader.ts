"use client";

/**
 * Minimal random-access .zip reader for "Build a timeline from photos".
 *
 * Why not JSZip (already a dependency): JSZip loads the whole archive
 * into memory, so a 1–2 GB zip of photos crashes phones and strains
 * laptops. This reads only the central directory (a few KB) from the end
 * of the file, then hands back each entry as a lazy File: photos are
 * almost always "stored" (uncompressed) in a zip, so the entry is just a
 * Blob.slice() of the original file — zero copy, nothing read until
 * EXIF/thumbnailing touches it. "Deflated" entries are inflated one at a
 * time with the browser's built-in DecompressionStream.
 *
 * Supports ZIP64 (Finder / Windows write it for big archives). Skips
 * encrypted entries and compression methods other than stored/deflate.
 */

export interface ZipEntry {
  name: string;
  /** Uncompressed size in bytes, from the directory — known without reading the entry. */
  size: number;
  /** Stored (uncompressed): file() is a free slice of the zip, so it's fine to call it again and again. */
  stored: boolean;
  /** Materialises the entry's bytes — free for stored entries, inflates deflated ones. */
  file(type: string): Promise<File>;
}

const EOCD_SIG = 0x06054b50;
const ZIP64_LOCATOR_SIG = 0x07064b50;
const ZIP64_EOCD_SIG = 0x06064b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
const MAX_U32 = 0xffffffff;

async function view(blob: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await blob.slice(start, end).arrayBuffer());
}

function u64(dv: DataView, offset: number): number {
  return Number(dv.getBigUint64(offset, true));
}

function dosDate(date: number, time: number): number {
  const d = new Date(1980 + (date >> 9), ((date >> 5) & 0xf) - 1, date & 0x1f, time >> 11, (time >> 5) & 0x3f, (time & 0x1f) * 2);
  return Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
}

const BAD_ZIP = "That doesn't look like a normal .zip file.";

export async function readZipEntries(zip: File): Promise<ZipEntry[]> {
  // End-of-central-directory record: 22 bytes + up to 64 KB comment, at the very end.
  const tailStart = Math.max(0, zip.size - (22 + 0xffff + 20));
  const tail = await view(zip, tailStart, zip.size);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error(BAD_ZIP);

  let count = tail.getUint16(eocd + 10, true);
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOffset = tail.getUint32(eocd + 16, true);

  if (cdOffset === MAX_U32 || cdSize === MAX_U32 || count === 0xffff) {
    const loc = eocd - 20;
    if (loc < 0 || tail.getUint32(loc, true) !== ZIP64_LOCATOR_SIG) throw new Error(BAD_ZIP);
    const z64Offset = u64(tail, loc + 8);
    const z64 = await view(zip, z64Offset, z64Offset + 56);
    if (z64.getUint32(0, true) !== ZIP64_EOCD_SIG) throw new Error(BAD_ZIP);
    count = u64(z64, 32);
    cdSize = u64(z64, 40);
    cdOffset = u64(z64, 48);
  }

  const cd = await view(zip, cdOffset, cdOffset + cdSize);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let p = 0;

  for (let n = 0; n < count && p + 46 <= cd.byteLength; n++) {
    if (cd.getUint32(p, true) !== CENTRAL_SIG) throw new Error(BAD_ZIP);
    const flags = cd.getUint16(p + 8, true);
    const method = cd.getUint16(p + 10, true);
    const modified = dosDate(cd.getUint16(p + 14, true), cd.getUint16(p + 12, true));
    let compressedSize = cd.getUint32(p + 20, true);
    let uncompressedSize = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    let localOffset = cd.getUint32(p + 42, true);
    const name = decoder.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));

    // ZIP64 extra field (id 0x0001) holds the real values of any field set to 0xFFFFFFFF, in this order.
    let e = p + 46 + nameLen;
    const extraEnd = e + extraLen;
    while (e + 4 <= extraEnd) {
      const id = cd.getUint16(e, true);
      const size = cd.getUint16(e + 2, true);
      if (id === 0x0001) {
        let q = e + 4;
        if (uncompressedSize === MAX_U32) {
          uncompressedSize = u64(cd, q);
          q += 8;
        }
        if (compressedSize === MAX_U32) {
          compressedSize = u64(cd, q);
          q += 8;
        }
        if (localOffset === MAX_U32) localOffset = u64(cd, q);
      }
      e += 4 + size;
    }
    p = extraEnd + commentLen;

    const encrypted = (flags & 0x1) !== 0;
    if (name.endsWith("/") || encrypted || (method !== 0 && method !== 8)) continue;

    const baseName = name.split("/").pop() ?? name;
    entries.push({
      name,
      size: uncompressedSize,
      stored: method === 0,
      async file(type: string) {
        // The local header's name/extra lengths can differ from the central directory's — read them.
        const local = await view(zip, localOffset, localOffset + 30);
        if (local.getUint32(0, true) !== LOCAL_SIG) throw new Error(`Couldn't read “${baseName}” from the zip.`);
        const dataStart = localOffset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
        const raw = zip.slice(dataStart, dataStart + compressedSize);
        const blob =
          method === 0 ? raw : await new Response(raw.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();
        return new File([blob], baseName, { type, lastModified: modified });
      },
    });
  }
  return entries;
}
