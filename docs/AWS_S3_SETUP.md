# AWS S3 setup for PhygitalEightThWall

This project stores campaign assets (images, videos, documents, QR PNGs, card renders) in **Amazon S3** instead of Cloudinary. The API issues **presigned PUT URLs** so browsers upload directly to S3; the server never proxies large files.

---

## 1. Create an S3 bucket

1. Sign in to the [AWS Console](https://console.aws.amazon.com/) and open **S3**.
2. Click **Create bucket**.
3. **Bucket name**: e.g. `phygital8thwall-assets-prod` (globally unique).
4. **Region**: choose the same region you will set in `AWS_REGION` (e.g. `ap-south-1`).
5. **Block Public Access**: keep **all four** blocks enabled (recommended). Public delivery should use **CloudFront**, not a public bucket.
6. **Bucket versioning**: optional (helps recovery); not required.
7. Create the bucket.

---

## 2. CORS (required for browser uploads)

1. Open your bucket → **Permissions** → **Cross-origin resource sharing (CORS)**.
2. Paste a policy like this (replace origins with your real app URLs):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://phygital8thwall-client.onrender.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Add every environment where users upload (local dev, staging, production).

---

## 3. IAM user for the API server

1. Open **IAM** → **Users** → **Create user** (e.g. `phygital8thwall-api`).
2. Attach a custom policy (adjust bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ObjectRW",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:DeleteObjects",
        "s3:ListBucket",
        "s3:GetObjectTagging",
        "s3:PutObjectTagging"
      ],
      "Resource": [
        "arn:aws:s3:::phygital8thwall-assets-prod",
        "arn:aws:s3:::phygital8thwall-assets-prod/*"
      ]
    }
  ]
}
```

3. Create **access key** for this user. Save:
   - Access key ID → `AWS_ACCESS_KEY_ID`
   - Secret access key → `AWS_SECRET_ACCESS_KEY`

On **Render / production**, prefer an **IAM role** attached to the service instead of long-lived keys.

---

## 4. CloudFront (recommended public URLs)

Browsers and the AR engine load assets over HTTPS from a CDN origin.

1. **CloudFront** → **Create distribution**.
2. **Origin domain**: select your S3 bucket (REST origin, not website endpoint).
3. **Origin access**: **Origin access control (OAC)** → create OAC for S3.
4. After creating the distribution, copy the **bucket policy** CloudFront suggests and apply it to the S3 bucket (allows `s3:GetObject` for the distribution only).
5. **Default cache behavior**: GET, HEAD, OPTIONS; compress objects automatically (optional).
6. Note the distribution domain, e.g. `d1234abcd.cloudfront.net`.

Set in server env:

```env
AWS_S3_PUBLIC_BASE_URL=https://d1234abcd.cloudfront.net
```

Object URLs become: `https://d1234abcd.cloudfront.net/phygital8thwall/{userId}/images/{id}.jpg`

**Without CloudFront** (local dev): set the virtual-hosted URL:

```env
AWS_S3_PUBLIC_BASE_URL=https://phygital-036071343832-us-east-2-an.s3.us-east-2.amazonaws.com
```

Keep **Block Public Access** enabled. Public hub/AR pages load media through **`GET /api/public/media/phygital8thwall/...`** (API streams from S3). No public bucket policy required. For production, set `API_PUBLIC_URL` (or `RENDER_EXTERNAL_URL`) on the API service. Optional later: CloudFront + OAC instead of the media proxy.

---

## 5. Lifecycle rule for abandoned draft uploads

Draft uploads are tagged `status=draft`. When a campaign is saved, the API sets `status=permanent`.

1. Bucket → **Management** → **Lifecycle rules** → **Create rule**.
2. Name: `expire-draft-uploads`.
3. Scope: limit by prefix `phygital8thwall/` (optional).
4. Add action **Expire current versions** after **1 day** with filter:
   - Object tags: `status` = `draft`
5. Save.

This matches the server’s `cleanupDraftAssetsByAge` job as a safety net.

---

## 6. Environment variables

Add to `server/.env` and your hosting dashboard:

| Variable | Example | Required |
|----------|---------|----------|
| `AWS_REGION` | `ap-south-1` | Yes |
| `AWS_S3_BUCKET` | `phygital8thwall-assets-prod` | Yes |
| `AWS_ACCESS_KEY_ID` | `AKIA...` | Yes (or use IAM role) |
| `AWS_SECRET_ACCESS_KEY` | `...` | Yes (or use IAM role) |
| `AWS_S3_PUBLIC_BASE_URL` | `https://d123.cloudfront.net` | Yes |
| `AWS_S3_UPLOAD_EXPIRES_SEC` | `900` | No |
| `AWS_S3_GET_EXPIRES_SEC` | `86400` | No (presigned read URLs for hub/AR) |
| `AWS_S3_ENDPOINT` | — | No (LocalStack/MinIO only) |
| `AWS_S3_FORCE_PATH_STYLE` | `true` | No (MinIO only) |

Remove old Cloudinary variables:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

---

## 7. Object key layout

| Path | Purpose |
|------|---------|
| `phygital8thwall/{userId}/images/{id}.jpg` | AR target, profile images |
| `phygital8thwall/{userId}/videos/{id}.mp4` | AR / hub videos |
| `phygital8thwall/{userId}/documents/{id}.pdf` | Doc hub files |
| `phygital8thwall/{userId}/qrcodes/qr_{campaignId}.png` | Generated QR |
| `phygital8thwall/{userId}/cards/{hash}.png` | Card print renders |

MongoDB stores the **S3 object key** in existing `*PublicId` fields (same field name as Cloudinary `public_id`).

---

## 8. Deletion behavior

- **Delete campaign**: API batch-deletes all related S3 keys (images, videos, docs, QR, card assets).
- **Update campaign** (replace video/image): old keys are deleted best-effort when swapped.
- **Draft cleanup**: hourly job + S3 lifecycle for tagged `status=draft`.

---

## 9. Verify the integration

1. Start API with new env vars; confirm boot log has no Cloudinary errors.
2. Create an AR campaign and upload image + video — check bucket for new objects.
3. Open campaign analytics / AR page — assets load from `AWS_S3_PUBLIC_BASE_URL`.
4. Delete campaign — objects removed from bucket (may take a few seconds).
5. Upload in wizard then abandon — after 24h, draft-tagged objects expire (lifecycle).

---

## 10. Migrating existing Cloudinary assets

Existing campaigns still point at `res.cloudinary.com` URLs in MongoDB. Options:

1. **Leave legacy URLs** until users re-upload or you run a migration script.
2. **One-time migration**: download from Cloudinary, `PutObject` to S3, update `url` + `publicId` in MongoDB.

No automatic migration is included in this change set.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Upload fails with CORS error | Update bucket CORS `AllowedOrigins` |
| `403` on PUT | Check IAM policy, presigned URL expiry, `Content-Type` matches signature; do not send `x-amz-tagging` (tagging is in the signed URL) |
| Images/videos 403 in browser | Use CloudFront + OAC, or keep direct S3 base URL (API presigns GETs for public pages) |
| Hub shows “timeout 20000ms” | Client cannot reach API — use Vite proxy (`/api`) locally or set `VITE_API_URL` to a live backend |
| Server won’t start | Set all required `AWS_*` vars (see `validateEnv.js`) |
