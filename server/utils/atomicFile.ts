import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Atomically writes UTF-8 text to a target file on the same filesystem:
 * 1. Ensures target directory exists
 * 2. Writes full serialized buffer to a unique temp file in the same directory
 * 3. Calls fsyncSync to flush OS buffers before rename
 * 4. Closes fd and atomically renames temp file over targetPath
 * 5. Enforces restrictive permissions and cleans up temp file on error
 */
export function atomicWriteFileSync(
  targetPath: string,
  serializedContent: string,
  mode = 0o600
): void {
  const dir = path.dirname(targetPath);
  const base = path.basename(targetPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = path.join(
    dir,
    `.${base}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`
  );

  let fd: number | null = null;
  try {
    const buffer = Buffer.from(serializedContent, 'utf-8');
    fd = fs.openSync(tmpPath, 'w', mode);
    let offset = 0;
    while (offset < buffer.length) {
      const written = fs.writeSync(fd, buffer, offset, buffer.length - offset);
      if (written <= 0) {
        throw new Error('Short write while writing temporary file');
      }
      offset += written;
    }
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;

    fs.renameSync(tmpPath, targetPath);
    fs.chmodSync(targetPath, mode);
  } catch (err) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore close failure during error cleanup
      }
    }
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {
      // ignore temp cleanup failure
    }
    throw err;
  }
}
