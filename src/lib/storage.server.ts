import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (_s3Client) return _s3Client;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 credentials (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) are not configured');
  }

  _s3Client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return _s3Client;
}

export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ENDPOINT &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

export interface UploadResult {
  url: string;
  key: string;
  filename: string;
  contentType: string;
  size: number;
}

/**
 * Validates magic bytes against allowed corporate file types for home building documents.
 * Disallows executable types, script types, HTML, and SVG to eliminate stored XSS.
 */
export function detectAndValidateMimeType(buffer: Buffer, filename: string): { valid: boolean; mime: string; error?: string } {
  if (!buffer || buffer.length < 4) {
    return { valid: false, mime: '', error: 'File payload is too small or empty.' };
  }

  const ext = (filename.split('.').pop() || '').toLowerCase();
  
  // Prohibit browser-executable and scripting extensions outright
  const PROHIBITED_EXTENSIONS = new Set([
    'svg', 'html', 'htm', 'xhtml', 'xml', 'php', 'exe', 'bat', 'cmd', 'sh', 'js', 'vbs', 'dll', 'cgi'
  ]);
  if (PROHIBITED_EXTENSIONS.has(ext)) {
    return { valid: false, mime: '', error: `File extension .${ext} is prohibited for security compliance.` };
  }

  const b0 = buffer[0];
  const b1 = buffer[1];
  const b2 = buffer[2];
  const b3 = buffer[3];

  // JPEG: FF D8 FF
  if (b0 === 0xff && b1 === 0xd8 && b2 === 0xff) {
    return { valid: true, mime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47
  if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4e && b3 === 0x47) {
    return { valid: true, mime: 'image/png' };
  }

  // GIF: 47 49 46 38
  if (b0 === 0x47 && b1 === 0x49 && b2 === 0x46 && b3 === 0x38) {
    return { valid: true, mime: 'image/gif' };
  }

  // WebP: 52 49 46 46 (RIFF) ... WEBP
  if (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46 && buffer.length >= 12) {
    const riffType = buffer.toString('ascii', 8, 12);
    if (riffType === 'WEBP') {
      return { valid: true, mime: 'image/webp' };
    }
  }

  // PDF: 25 50 44 46 (%PDF)
  if (b0 === 0x25 && b1 === 0x50 && b2 === 0x44 && b3 === 0x46) {
    return { valid: true, mime: 'application/pdf' };
  }

  // PK (ZIP, DOCX, XLSX): 50 4B 03 04
  if (b0 === 0x50 && b1 === 0x4b && b2 === 0x03 && b3 === 0x04) {
    if (ext === 'docx') {
      return { valid: true, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    }
    if (ext === 'xlsx') {
      return { valid: true, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    }
    return { valid: true, mime: 'application/octet-stream' };
  }

  // DWG (AutoCAD Drawing): 41 43 31 30 (AC10)
  if (b0 === 0x41 && b1 === 0x43 && b2 === 0x31 && b3 === 0x30) {
    return { valid: true, mime: 'application/acad' };
  }

  // DXF text format
  if (ext === 'dxf') {
    const head = buffer.slice(0, 100).toString('utf8');
    if (head.includes('SECTION') || head.includes('HEADER')) {
      return { valid: true, mime: 'application/dxf' };
    }
  }

  // Plain text / CSV
  if (ext === 'txt' || ext === 'csv') {
    return { valid: true, mime: ext === 'csv' ? 'text/csv' : 'text/plain' };
  }

  return { valid: false, mime: '', error: 'Unrecognized file format header signature.' };
}

/**
 * Uploads an attachment to Cloudflare R2 bucket with strict magic-byte validation
 * and attachment disposition to prevent stored XSS.
 */
export async function uploadAttachmentToR2(options: {
  buffer: Buffer | Uint8Array;
  filename: string;
  contentType?: string;
  folder?: string;
}): Promise<UploadResult> {
  const buf = Buffer.isBuffer(options.buffer) ? options.buffer : Buffer.from(options.buffer);

  // 1. Enforce 10MB binary size cap
  const MAX_BYTES = 10 * 1024 * 1024;
  if (buf.length > MAX_BYTES) {
    throw new Error(`File size (${(buf.length / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed limit of 10MB.`);
  }

  // 2. Validate Magic Bytes & Prohibit Malicious File Types
  const validation = detectAndValidateMimeType(buf, options.filename);
  if (!validation.valid) {
    throw new Error(`Security Exception: ${validation.error}`);
  }

  const client = getS3Client();
  const bucket = process.env.R2_BUCKET_NAME || 'weaverframe-storage';
  const folder = options.folder || 'attachments';
  
  // 3. Sanitized filename and UUID-based object key to eliminate path traversal & predictable keys
  const safeFilename = options.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uuidKey = crypto.randomUUID();
  const key = `${folder}/${uuidKey}-${safeFilename}`;

  const verifiedContentType = validation.mime || options.contentType || 'application/octet-stream';

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buf,
      ContentType: verifiedContentType,
      // Enforce download attachment disposition to prevent browser-rendered HTML/SVG execution
      ContentDisposition: `attachment; filename="${safeFilename}"`,
    })
  );

  const publicBase = (process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  const url = publicBase ? `${publicBase}/${key}` : key;

  return {
    url,
    key,
    filename: options.filename,
    contentType: verifiedContentType,
    size: buf.length,
  };
}

/**
 * Scans a message content string for base64 data URLs in attachment tokens,
 * validates size & content types before allocating memory, uploads to Cloudflare R2,
 * and updates content string with R2 URLs.
 */
export async function processAndUploadContentAttachments(
  content: string,
  leadId: string
): Promise<string> {
  if (!content || !isR2Configured()) return content;

  // Maximum base64 string length corresponding to ~10MB binary
  const MAX_BASE64_LENGTH = 14 * 1024 * 1024;

  const lines = content.split(/\r?\n/);
  let modified = false;

  const newLines = await Promise.all(
    lines.map(async (line) => {
      const trimmed = line.trim();

      if (trimmed.startsWith('🖼️ Image Shared:')) {
        const metaStr = trimmed.replace('🖼️ Image Shared:', '').trim();
        const [nameParam, sizeParam, dataUrlParam] = metaStr.split('|');
        const filename = nameParam || 'image.jpg';
        const dataUrl = dataUrlParam ? dataUrlParam.replace('data=', '') : '';

        if (dataUrl && dataUrl.startsWith('data:')) {
          try {
            const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const base64Data = matches[2];
              // Pre-allocation Base64 DoS guard (Finding 6.2)
              if (base64Data.length > MAX_BASE64_LENGTH) {
                console.warn('[STORAGE] Attachment exceeds maximum allowable size (10MB), skipped.');
                return line;
              }

              const buffer = Buffer.from(base64Data, 'base64');
              const res = await uploadAttachmentToR2({
                buffer,
                filename,
                contentType: matches[1],
                folder: `leads/${leadId}/images`,
              });
              modified = true;
              return `🖼️ Image Shared: ${nameParam}|${sizeParam}|data=${res.url}`;
            }
          } catch (err: any) {
            console.warn('[STORAGE] Failed to upload image to R2:', err.message);
          }
        }
      }

      if (trimmed.startsWith('📎 File Attachment:')) {
        const metaStr = trimmed.replace('📎 File Attachment:', '').trim();
        const parts = metaStr.split('|');
        const filename = parts[0] || 'attachment.pdf';
        let dataIndex = -1;
        let dataUrl = '';
        let fileType = 'application/octet-stream';

        for (let i = 1; i < parts.length; i++) {
          if (parts[i].startsWith('type=')) fileType = parts[i].replace('type=', '');
          if (parts[i].startsWith('data=')) {
            dataIndex = i;
            dataUrl = parts[i].replace('data=', '');
          }
        }

        if (dataUrl && dataUrl.startsWith('data:')) {
          try {
            const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              const base64Data = matches[2];
              // Pre-allocation Base64 DoS guard (Finding 6.2)
              if (base64Data.length > MAX_BASE64_LENGTH) {
                console.warn('[STORAGE] Document exceeds maximum allowable size (10MB), skipped.');
                return line;
              }

              const buffer = Buffer.from(base64Data, 'base64');
              const res = await uploadAttachmentToR2({
                buffer,
                filename,
                contentType: matches[1] || fileType,
                folder: `leads/${leadId}/files`,
              });
              modified = true;
              parts[dataIndex] = `data=${res.url}`;
              return `📎 File Attachment: ${parts.join('|')}`;
            }
          } catch (err: any) {
            console.warn('[STORAGE] Failed to upload document to R2:', err.message);
          }
        }
      }

      return line;
    })
  );

  return modified ? newLines.join('\n') : content;
}
