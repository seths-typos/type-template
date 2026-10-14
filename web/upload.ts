import { isZip, readZipEntry } from './import/zip.js';

/** A file to read, by name, from a picker or a drop. */
export interface UploadFile {
  name: string;
  bytes: ArrayBuffer;
}

/** Something chosen or dropped that can't be read, with why, for the user. */
export class UploadError extends Error {
  override name = 'UploadError';
}

/**
 * A .ufo or a .glyphspackage is a folder, and both keep their font-level
 * metrics in the `fontinfo.plist` at its top, so that one file is all a
 * folder is read for.
 */
const FONT_INFO = 'fontinfo.plist';

const noFontInfo = (folder: string) =>
  new UploadError(`${folder} has no ${FONT_INFO}. Choose a .ufo or .glyphspackage.`);

/** `fontinfo.plist` at the top of the folder, or at the top of the zip. */
const isFontInfo = (path: string) =>
  !path.startsWith('__MACOSX/') && /^(?:[^/]+\/)?fontinfo\.plist$/.test(path);

/**
 * A zipped folder — a .ufo or .glyphspackage as Chrome on macOS sends one,
 * or a .ufoz — opened to its `fontinfo.plist`. Anything else as it is.
 */
async function unpack(file: UploadFile): Promise<UploadFile> {
  if (!isZip(file.bytes)) return file;
  const name = file.name.replace(/\.zip$/i, '');
  let info;
  try {
    info = await readZipEntry(file.bytes, isFontInfo);
  } catch {
    throw new UploadError(`${name} couldn’t be unzipped.`);
  }
  if (!info) throw noFontInfo(name);
  return { name, bytes: info.bytes };
}

/**
 * Ask for a file with the system's file picker; null if none was chosen. A
 * .ufo or .glyphspackage can be chosen as one: macOS shows them as packages,
 * and Chrome sends a package zipped.
 */
export function pickFile(): Promise<UploadFile | null> {
  // On the page, hidden, while the picker is open. Off it, nothing holds the
  // input, and a browser may collect it before the choice comes back — no
  // change event, nothing loaded, until the second try. Safari does.
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.glyphs,.plist,.ufo,.glyphspackage,.ufoz,.zip';
  input.hidden = true;
  document.body.append(input);

  return new Promise<UploadFile | null>((resolve, reject) => {
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.arrayBuffer().then(
        (bytes) => unpack({ name: file.name, bytes }).then(resolve, reject),
        () => reject(new UploadError(`${file.name} couldn’t be read.`)),
      );
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  }).finally(() => input.remove());
}

/**
 * What was dropped: a file, or a folder read through its `fontinfo.plist`
 * — whether it arrives as a folder or, as a package does, zipped.
 */
export async function droppedFile(data: DataTransfer): Promise<UploadFile | null> {
  const item = Array.from(data.items).find((i) => i.kind === 'file');
  if (!item) return null;

  // Both taken now: the drop's items are emptied once its handler returns.
  const entry = item.webkitGetAsEntry?.();
  const file = item.getAsFile();

  if (entry?.isDirectory) {
    const folder = entry as FileSystemDirectoryEntry;
    const info = await new Promise<FileSystemFileEntry | null>((resolve) =>
      folder.getFile(FONT_INFO, {}, (e) => resolve(e as FileSystemFileEntry), () => resolve(null)),
    );
    if (info) {
      const plist = await new Promise<File>((resolve, reject) => info.file(resolve, reject));
      return { name: folder.name, bytes: await plist.arrayBuffer() };
    }
    // A package can come as a folder entry with its zip as the file.
    if (!file) throw noFontInfo(folder.name);
  }

  return file ? unpack({ name: file.name, bytes: await file.arrayBuffer() }) : null;
}

/** Hand `text` to the user as a download named `name`. */
export function downloadText(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
