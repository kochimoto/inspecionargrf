/**
 * Google Drive integration (REST API via fetch — no extra dependencies).
 *
 * Required env vars (set in Vercel → Settings → Environment Variables):
 *   GOOGLE_DRIVE_CLIENT_ID
 *   GOOGLE_DRIVE_CLIENT_SECRET
 *   GOOGLE_DRIVE_REFRESH_TOKEN   (generate with `node scripts/google-drive-auth.mjs`)
 * Optional:
 *   GOOGLE_DRIVE_ROOT_FOLDER_ID  (folder where plates are stored; if empty,
 *                                 a "GRF Vistorias" folder is created in My Drive)
 *
 * Folder structure:  GRF Vistorias / <PLACA> / <AAAA-MM-DD HHhMM ENTRADA|SAIDA> / foto.jpg
 *
 * If the env vars are missing, `isDriveEnabled()` returns false and callers
 * should fall back to storing the photo in the database (legacy behaviour).
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const ROOT_FOLDER_NAME = "GRF Vistorias";

/** Prefix used in Photo.url for files stored in Drive (served by /api/drive/[fileId]). */
export const DRIVE_URL_PREFIX = "/api/drive/";

export function isDriveEnabled() {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN
  );
}

export function driveFileUrl(fileId: string) {
  return `${DRIVE_URL_PREFIX}${fileId}`;
}

// ── Access token (cached per server instance) ───────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getDriveAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Google OAuth falhou (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

async function driveFetch(url: string, init: RequestInit = {}) {
  const token = await getDriveAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Google Drive erro (${res.status}): ${await res.text()}`);
  }
  return res;
}

// ── Folders ─────────────────────────────────────────────────────────────────

const folderCache = new Map<string, Promise<string>>();

function escapeQuery(v: string) {
  return v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findOrCreateFolder(name: string, parentId: string | null): Promise<string> {
  const cacheKey = `${parentId ?? "root"}/${name}`;
  const cached = folderCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const parentClause = parentId ? `'${escapeQuery(parentId)}' in parents` : `'root' in parents`;
    const q = `name = '${escapeQuery(name)}' and mimeType = '${FOLDER_MIME}' and ${parentClause} and trashed = false`;
    const listRes = await driveFetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`
    );
    const list = (await listRes.json()) as { files: { id: string }[] };
    if (list.files.length > 0) return list.files[0].id;

    const createRes = await driveFetch(`${DRIVE_API}/files?fields=id&supportsAllDrives=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: FOLDER_MIME,
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    });
    const created = (await createRes.json()) as { id: string };
    return created.id;
  })();

  folderCache.set(cacheKey, promise);
  promise.catch(() => folderCache.delete(cacheKey));
  return promise;
}

async function getRootFolderId() {
  const configured = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim();
  if (configured) return configured;
  return findOrCreateFolder(ROOT_FOLDER_NAME, null);
}

function formatFolderDate(date: Date) {
  // Always use Brazil time for folder names
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}h${get("minute")}`;
}

export interface MovementFolderInfo {
  licensePlate: string;
  movementType: "ENTRY" | "EXIT" | string;
  createdAt: Date;
}

export async function ensurePlateFolder(licensePlate: string) {
  const rootId = await getRootFolderId();
  return findOrCreateFolder(licensePlate.toUpperCase(), rootId);
}

/** Returns (creating if needed) the folder  ROOT / PLACA / DATA TIPO  for a movement. */
export async function ensureMovementFolder(info: MovementFolderInfo) {
  const plateId = await ensurePlateFolder(info.licensePlate);
  const typeLabel = info.movementType === "EXIT" ? "SAIDA" : "ENTRADA";
  return findOrCreateFolder(`${formatFolderDate(info.createdAt)} ${typeLabel}`, plateId);
}

// ── Upload ──────────────────────────────────────────────────────────────────

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error("Formato de imagem inválido.");
  const mime = match[1] || "image/jpeg";
  const isBase64 = Boolean(match[2]);
  const buffer = isBase64
    ? Buffer.from(match[3], "base64")
    : Buffer.from(decodeURIComponent(match[3]), "utf8");
  return { mime, buffer };
}

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_\- ]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80) || "foto";
}

/**
 * Uploads a base64 data URL image into the movement folder.
 * Returns the Drive file id.
 */
export async function uploadPhotoToDrive(params: {
  dataUrl: string;
  folder: MovementFolderInfo;
  baseName: string;
}) {
  const folderId = await ensureMovementFolder(params.folder);
  const { mime, buffer } = parseDataUrl(params.dataUrl);
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const fileName = `${safeFileName(params.baseName)}_${Date.now().toString(36)}.${ext}`;

  const boundary = `grf-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: fileName, parents: [folderId], mimeType: mime });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await driveFetch(
    `${UPLOAD_API}/files?uploadType=multipart&fields=id&supportsAllDrives=true`,
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  const json = (await res.json()) as { id: string };
  return json.id;
}

/** Streams a Drive file's content (used by the /api/drive/[fileId] proxy). */
export async function downloadDriveFile(fileId: string) {
  return driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`
  );
}
