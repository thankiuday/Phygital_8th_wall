'use strict';

const { S3Client } = require('@aws-sdk/client-s3');

let client = null;

/**
 * Singleton S3 client. Supports optional custom endpoint (LocalStack, MinIO).
 */
const getS3Client = () => {
  if (client) return client;

  const region = process.env.AWS_REGION || 'us-east-1';
  const endpoint = (process.env.AWS_S3_ENDPOINT || '').trim() || undefined;
  const forcePathStyle = process.env.AWS_S3_FORCE_PATH_STYLE === 'true';

  client = new S3Client({
    region,
    endpoint,
    forcePathStyle: !!forcePathStyle,
    credentials: process.env.AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  });

  return client;
};

const getBucket = () => {
  const bucket = (process.env.AWS_S3_BUCKET || '').trim();
  if (!bucket) throw new Error('AWS_S3_BUCKET is not configured');
  return bucket;
};

/**
 * Public base URL for object keys (CloudFront or S3 static website).
 * No trailing slash. Example: https://d111111abcdef8.cloudfront.net
 */
const getPublicBaseUrl = () => {
  const base = (process.env.AWS_S3_PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  if (!base) throw new Error('AWS_S3_PUBLIC_BASE_URL is not configured');
  return base;
};

module.exports = { getS3Client, getBucket, getPublicBaseUrl };
