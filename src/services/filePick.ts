import { Platform } from 'react-native';
import type { UploadedFlyerFile } from '@/domain/types';

/**
 * Web-guarded flyer file picking. NO top-level DOM imports/usage — jest runs in
 * node and native must never touch `document`. Every DOM reference sits inside a
 * Platform.OS === 'web' guard, mirroring services/share.ts and services/links.ts.
 */

export const FLYER_ACCEPT = 'application/pdf,image/png,image/jpeg';

/** Whether interactive file pick/drop is available in this environment. */
export function isFilePickSupported(): boolean {
  return Platform.OS === 'web' && typeof document !== 'undefined';
}

/**
 * Wrap a browser File into a persistence-safe descriptor. The object URL in
 * `uri` is transient — the caller MUST revoke it (revokeUploadedFile) once the
 * extractor is done, and it is never written to storage.
 */
export function toUploadedFile(file: File): UploadedFlyerFile {
  return {
    name: file.name,
    mimeType: file.type,
    size: file.size,
    uri: URL.createObjectURL(file),
  };
}

/** Release the object URL created by toUploadedFile (web only, best-effort). */
export function revokeUploadedFile(f: UploadedFlyerFile): void {
  if (
    Platform.OS === 'web' &&
    typeof URL !== 'undefined' &&
    f.uri.startsWith('blob:')
  ) {
    URL.revokeObjectURL(f.uri);
  }
}

/**
 * Open the OS file picker and resolve the chosen flyer, or null if unsupported
 * / dismissed without a selection. Uses a throwaway hidden <input type="file">.
 */
export function pickFlyerFile(): Promise<UploadedFlyerFile | null> {
  if (!isFilePickSupported()) return Promise.resolve(null);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = FLYER_ACCEPT;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      resolve(file ? toUploadedFile(file) : null);
      input.remove();
    });
    document.body.appendChild(input);
    input.click();
  });
}
