import { promises as fs } from "fs";
import path from "path";
import type { FileStorage } from "./index";

// Dev/sandbox-only implementation: files live on this machine's disk,
// under a directory that's gitignored and outside `public/` (so Next.js
// never serves it as a static file by accident). `key` is always a value
// this module generated itself (see app/api/projects/[id]/documents —
// cuid + a slugified filename), never taken from user input directly, so
// there's no path-traversal surface from an attacker-chosen key.
const ROOT = path.resolve(process.env.FILE_STORAGE_LOCAL_DIR || path.join(process.cwd(), "storage"));

function resolveKey(key: string): string {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) {
    // Defense in depth — should be unreachable given keys are
    // server-generated, but a storage layer that *could* escape its root
    // on a malformed key is a bug worth refusing loudly rather than
    // silently reading/writing outside it.
    throw new Error("Invalid storage key");
  }
  return full;
}

export const localFileStorage: FileStorage = {
  async save(key, data) {
    const full = resolveKey(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  },
  async read(key) {
    return fs.readFile(resolveKey(key));
  },
};
