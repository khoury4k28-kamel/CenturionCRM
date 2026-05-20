import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function saveUpload(file: File, prefix: string): Promise<{ url: string; absPath: string; ext: string }> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name).toLowerCase() || guessExt(file.type);
  const filename = `${prefix}_${Date.now()}_${randomUUID().slice(0, 8)}${ext}`;
  const absPath = path.join(UPLOAD_DIR, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absPath, buffer);
  return { url: `/uploads/${filename}`, absPath, ext };
}

export async function saveBuffer(buffer: Buffer, filename: string): Promise<{ url: string; absPath: string }> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const absPath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(absPath, buffer);
  return { url: `/uploads/${filename}`, absPath };
}

export async function readUploadByUrl(url: string): Promise<Buffer> {
  // url is like "/uploads/foo.docx"; map back to absolute filesystem path.
  if (!url.startsWith("/uploads/")) throw new Error(`Unexpected URL: ${url}`);
  const filename = url.replace(/^\/uploads\//, "");
  const absPath = path.join(UPLOAD_DIR, filename);
  return await fs.readFile(absPath);
}

function guessExt(mime: string) {
  if (mime === "application/pdf") return ".pdf";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return ".docx";
  return "";
}
