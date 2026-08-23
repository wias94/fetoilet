import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 没配`);
  return value;
}

function client() {
  const account = required("R2_ACCOUNT_ID");
  return {
    bucket: required("R2_BUCKET"),
    s3: new S3Client({
      region: "auto",
      endpoint: `https://${account}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
    }),
  };
}

export function stallPhotoKey(stallId: string) {
  return `stalls/${stallId}.jpg`;
}

export function stallPhotoPath(stallId: string) {
  const base = process.env.R2_PUBLIC_BASE?.trim().replace(/\/$/, "");
  if (base) return `${base}/${stallPhotoKey(stallId)}`;
  return `/api/media/${stallPhotoKey(stallId)}`;
}

export async function putStallJpeg(stallId: string, dataUrl: string) {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  if (!match) throw new Error("图不是 jpeg");
  const body = Buffer.from(match[1], "base64");
  if (body.length < 32) throw new Error("图太小");
  const { s3, bucket } = client();
  const key = stallPhotoKey(stallId);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=86400",
    }),
  );
  return stallPhotoPath(stallId);
}

export async function getR2Object(key: string) {
  const { s3, bucket } = client();
  const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = out.Body ? await out.Body.transformToByteArray() : new Uint8Array();
  return {
    bytes,
    contentType: out.ContentType ?? "application/octet-stream",
  };
}
