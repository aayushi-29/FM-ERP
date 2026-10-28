// File storage is behind this interface specifically so Decision #8
// ("private object storage, no public file URLs; provider TBD") can be
// resolved later without touching a single API route. Every document
// route below calls only these three functions — never `fs` directly,
// never an S3 SDK directly — so swapping the local-disk implementation
// for S3/R2/whatever Food Monk picks is a one-file change.
//
// `storageKey` is an opaque string the driver controls the shape of; API
// routes never construct a public URL from it and never serve it as a
// static asset — every read goes through an authorized download route
// that streams the bytes after a permission check (baseline §9: "Store
// files privately and authorize every upload, preview, download, and
// export").
export interface FileStorage {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
}

import { localFileStorage } from "./local";

// FILE_STORAGE_DRIVER selects the implementation. Only "local" exists
// today (this sandbox/dev machine's disk) — it is NOT suitable for a real
// deployment (not durable across redeploys, not shared across instances,
// no encryption-at-rest guarantee beyond the host disk's own). Decision
// #8's chosen provider (S3-compatible, most likely) plugs in here as a
// second implementation of the same three-function interface; nothing
// else in the app needs to change.
export const storage: FileStorage = localFileStorage;
