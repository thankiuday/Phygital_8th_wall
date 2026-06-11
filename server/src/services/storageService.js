'use strict';

const path = require('path');
const crypto = require('crypto');
const {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectTaggingCommand,
  GetObjectTaggingCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getS3Client, getBucket, getPublicBaseUrl } = require('../config/s3');
const logger = require('../config/logger');

const DRAFT_ASSET_TAG = 'draft-temp';
const DRAFT_TAG_KEY = 'status';
const DRAFT_TAG_VALUE = 'draft';
const PERMANENT_TAG_VALUE = 'permanent';

const UPLOAD_EXPIRES_SEC = Math.min(
  3600,
  Math.max(300, Number(process.env.AWS_S3_UPLOAD_EXPIRES_SEC) || 900)
);

const GET_EXPIRES_SEC = Math.min(
  604800,
  Math.max(3600, Number(process.env.AWS_S3_GET_EXPIRES_SEC) || 86400)
);

const MANAGED_KEY_PREFIX = 'phygital8thwall/';

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
};

const sanitizeFilename = (name) => {
  const base = path.basename(String(name || 'file'));
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file';
};

const extFromContentType = (contentType, fallback = 'bin') => {
  const ct = String(contentType || '').split(';')[0].trim().toLowerCase();
  return MIME_EXT[ct] || fallback;
};

const folderSuffixFor = (resourceType) => {
  if (resourceType === 'raw') return 'documents';
  if (resourceType === 'video') return 'videos';
  return 'images';
};

/**
 * Object key stored in Campaign `*PublicId` fields.
 * @param {{ userId: string, resourceType: string, filename?: string, contentType?: string }} opts
 */
const buildObjectKey = ({ userId, resourceType, filename, contentType }) => {
  const suffix = folderSuffixFor(resourceType);
  const ext = path.extname(sanitizeFilename(filename)).replace(/^\./, '')
    || extFromContentType(contentType, resourceType === 'video' ? 'mp4' : 'jpg');
  const id = crypto.randomBytes(12).toString('hex');
  return `phygital8thwall/${userId}/${suffix}/${id}.${ext}`;
};

const publicUrlForKey = (key) => {
  const encodedKey = String(key)
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `${getPublicBaseUrl()}/${encodedKey}`;
};

const isDirectS3Hostname = (hostname) =>
  typeof hostname === 'string'
  && hostname.includes('.s3.')
  && hostname.endsWith('.amazonaws.com');

/**
 * Extract object key from a URL stored on Campaign assets (S3 or public base host).
 */
const keyFromManagedAssetUrl = (url) => {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    const u = new URL(url);
    const bucket = getBucket();
    if (u.hostname.startsWith(`${bucket}.s3.`) && isDirectS3Hostname(u.hostname)) {
      const key = decodeURIComponent(u.pathname.replace(/^\//, ''));
      return key.startsWith(MANAGED_KEY_PREFIX) ? key : null;
    }
    const baseHost = new URL(getPublicBaseUrl()).hostname;
    if (u.hostname === baseHost) {
      const key = decodeURIComponent(u.pathname.replace(/^\//, ''));
      return key.startsWith(MANAGED_KEY_PREFIX) ? key : null;
    }
    return null;
  } catch {
    return null;
  }
};

/** Private buckets need presigned GET when URLs point at S3, not CloudFront. */
const needsPresignedGetUrl = (url) => {
  const key = keyFromManagedAssetUrl(url);
  if (!key) return false;
  try {
    return isDirectS3Hostname(new URL(url).hostname);
  } catch {
    return false;
  }
};

/**
 * Time-limited HTTPS URL for browser playback (hub, AR, public pages).
 * CloudFront URLs are returned unchanged.
 */
const getPresignedReadUrlForKey = async (key) => {
  const normalized = String(key || '').trim();
  if (!normalized.startsWith(MANAGED_KEY_PREFIX)) return null;
  try {
    const s3 = getS3Client();
    return await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: getBucket(), Key: normalized }),
      { expiresIn: GET_EXPIRES_SEC }
    );
  } catch (err) {
    logger.warn('S3 presigned GET failed', { key: normalized, error: err?.message });
    return null;
  }
};

const getPresignedReadUrl = async (url) => {
  if (!url) return url;
  const key = keyFromManagedAssetUrl(url);
  if (key) {
    const signed = await getPresignedReadUrlForKey(key);
    if (signed) return signed;
  }
  if (!needsPresignedGetUrl(url)) return url;
  return url;
};

/**
 * Presigned PUT upload for browser-direct uploads (replaces Cloudinary signed upload).
 */
const generateUploadSignature = async (options) => {
  const {
    resourceType = 'image',
    folder,
    tags = [],
    contentType = 'application/octet-stream',
    filename = 'file',
  } = options;

  const folderParts = String(folder || '').split('/').filter(Boolean);
  const userId = folderParts[1] || 'guest';
  const isDraft = Array.isArray(tags) && tags.includes(DRAFT_ASSET_TAG);
  const key = buildObjectKey({
    userId,
    resourceType,
    filename,
    contentType,
  });

  const s3 = getS3Client();
  const bucket = getBucket();

  const putParams = {
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  };
  if (isDraft) {
    putParams.Tagging = `${DRAFT_TAG_KEY}=${DRAFT_TAG_VALUE}`;
  } else {
    putParams.Tagging = `${DRAFT_TAG_KEY}=${PERMANENT_TAG_VALUE}`;
  }

  const uploadUrl = await getSignedUrl(s3, new PutObjectCommand(putParams), {
    expiresIn: UPLOAD_EXPIRES_SEC,
  });

  // Tagging is signed via PutObjectCommand.Tagging — do not send x-amz-tagging
  // from the browser; unsigned extra headers cause S3 403 AccessDenied.

  return {
    uploadUrl,
    method: 'PUT',
    key,
    publicId: key,
    publicUrl: publicUrlForKey(key),
    headers: {
      'Content-Type': contentType,
    },
    expiresIn: UPLOAD_EXPIRES_SEC,
    resourceType,
  };
};

const uploadBuffer = async ({
  buffer,
  key,
  contentType = 'image/png',
  tags = null,
}) => {
  const s3 = getS3Client();
  const bucket = getBucket();
  const params = {
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  };
  if (tags) params.Tagging = tags;

  await s3.send(new PutObjectCommand(params));
  return {
    key,
    publicId: key,
    url: publicUrlForKey(key),
    secure_url: publicUrlForKey(key),
  };
};

const headObject = async (key) => {
  try {
    const s3 = getS3Client();
    await s3.send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return true;
  } catch (err) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
};

const toUniqueKeys = (ids = []) => [...new Set(
  (Array.isArray(ids) ? ids : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)
)];

const claimUploadedDraftAssets = async ({ image = [], video = [], raw = [] } = {}) => {
  const keys = toUniqueKeys([...image, ...video, ...raw]);
  if (!keys.length) return;

  const s3 = getS3Client();
  const bucket = getBucket();

  await Promise.all(keys.map(async (key) => {
    try {
      await s3.send(new PutObjectTaggingCommand({
        Bucket: bucket,
        Key: key,
        Tagging: {
          TagSet: [{ Key: DRAFT_TAG_KEY, Value: PERMANENT_TAG_VALUE }],
        },
      }));
    } catch (err) {
      logger.warn('S3 claim draft tag failed', { key, error: err?.message });
    }
  }));
};

const cleanupDraftAssetsByAge = async ({ maxAgeHours = 24, maxPerRun = 100 } = {}) => {
  const cutoffMs = Date.now() - (Math.max(1, Number(maxAgeHours)) * 60 * 60 * 1000);
  const s3 = getS3Client();
  const bucket = getBucket();
  let deletedCount = 0;
  let continuationToken;

  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: 'phygital8thwall/',
      ContinuationToken: continuationToken,
      MaxKeys: 200,
    }));

    const contents = list.Contents || [];
    for (const obj of contents) {
      if (deletedCount >= maxPerRun) break;
      if (!obj.Key || !obj.LastModified || obj.LastModified.getTime() > cutoffMs) continue;

      try {
        const tagging = await s3.send(new GetObjectTaggingCommand({
          Bucket: bucket,
          Key: obj.Key,
        }));
        const status = tagging.TagSet?.find((t) => t.Key === DRAFT_TAG_KEY)?.Value;
        if (status !== DRAFT_TAG_VALUE) continue;

        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
        deletedCount += 1;
      } catch (err) {
        logger.warn('S3 draft cleanup skip', { key: obj.Key, error: err?.message });
      }
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken && deletedCount < maxPerRun);

  return { deletedCount };
};

/** Delete one object (publicId = S3 key). resourceType kept for API compatibility. */
const deleteStorageAsset = async (publicId, _resourceType = 'image') => {
  const key = String(publicId || '').trim();
  if (!key) return;
  try {
    const s3 = getS3Client();
    await s3.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
  } catch (err) {
    logger.warn('S3 delete failed', { key, error: err?.message });
  }
};

/** Batch delete up to 1000 keys per request. */
const deleteStorageAssets = async (keys = []) => {
  const unique = toUniqueKeys(keys);
  if (!unique.length) return;

  const s3 = getS3Client();
  const bucket = getBucket();

  for (let i = 0; i < unique.length; i += 1000) {
    const chunk = unique.slice(i, i + 1000);
    try {
      await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: true,
        },
      }));
    } catch (err) {
      logger.warn('S3 batch delete failed', { count: chunk.length, error: err?.message });
    }
  }
};

// Back-compat aliases used across controllers
const deleteCloudinaryAsset = deleteStorageAsset;

module.exports = {
  DRAFT_ASSET_TAG,
  buildObjectKey,
  publicUrlForKey,
  keyFromManagedAssetUrl,
  needsPresignedGetUrl,
  getPresignedReadUrl,
  getPresignedReadUrlForKey,
  generateUploadSignature,
  uploadBuffer,
  headObject,
  claimUploadedDraftAssets,
  cleanupDraftAssetsByAge,
  deleteStorageAsset,
  deleteStorageAssets,
  deleteCloudinaryAsset,
};
