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
 * Uploads an attachment (buffer or string) to Cloudflare R2 bucket.
 * Returns the public CDN URL and storage key.
 */
export async function uploadAttachmentToR2(options: {
  buffer: Buffer | Uint8Array;
  filename: string;
  contentType?: string;
  folder?: string;
}): Promise<UploadResult> {
  const client = getS3Client();
  const bucket = process.env.R2_BUCKET_NAME || 'weaverframe-storage';
  const folder = options.folder || 'attachments';
  
  // Clean filename and generate unique timestamped key
  const safeFilename = options.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueId = crypto.randomBytes(6).toString('hex');
  const key = `${folder}/${Date.now()}-${uniqueId}-${safeFilename}`;

  const contentType = options.contentType || 'application/octet-stream';

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: options.buffer,
      ContentType: contentType,
    })
  );

  const publicBase = (process.env.R2_PUBLIC_URL || '').trim().replace(/\/+$/, '');
  const url = publicBase ? `${publicBase}/${key}` : key;

  return {
    url,
    key,
    filename: options.filename,
    contentType,
    size: options.buffer.length,
  };
}

/**
 * Scans a message content string for base64 data URLs in attachment tokens
 * (Image Shared or File Attachment), uploads each binary payload to Cloudflare R2,
 * and returns the updated content string where data=<base64> is replaced with data=<r2Url>.
 */
export async function processAndUploadContentAttachments(
  content: string,
  leadId: string
): Promise<string> {
  if (!content || !isR2Configured()) return content;

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
              const contentType = matches[1];
              const buffer = Buffer.from(matches[2], 'base64');
              const res = await uploadAttachmentToR2({
                buffer,
                filename,
                contentType,
                folder: `leads/${leadId}/images`,
              });
              modified = true;
              return `🖼️ Image Shared: ${nameParam}|${sizeParam}|data=${res.url}`;
            }
          } catch (err) {
            console.warn('[STORAGE] Failed to upload image to R2:', err);
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
              const contentType = matches[1] || fileType;
              const buffer = Buffer.from(matches[2], 'base64');
              const res = await uploadAttachmentToR2({
                buffer,
                filename,
                contentType,
                folder: `leads/${leadId}/files`,
              });
              modified = true;
              parts[dataIndex] = `data=${res.url}`;
              return `📎 File Attachment: ${parts.join('|')}`;
            }
          } catch (err) {
            console.warn('[STORAGE] Failed to upload document to R2:', err);
          }
        }
      }

      return line;
    })
  );

  return modified ? newLines.join('\n') : content;
}

