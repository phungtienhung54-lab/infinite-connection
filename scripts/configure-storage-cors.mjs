import nextEnv from "@next/env";
import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const required = [
  "AWS_ENDPOINT_URL_S3",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Missing storage environment variables: ${missing.join(", ")}`);
}

const configuredOrigins = (process.env.STORAGE_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([
  "http://localhost:3000",
  "https://repo-beta-self.vercel.app",
  ...configuredOrigins,
])];

const client = new S3Client({
  endpoint: process.env.AWS_ENDPOINT_URL_S3,
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

await client.send(new PutBucketCorsCommand({
  Bucket: "user-content",
  CORSConfiguration: {
    CORSRules: [{
      AllowedHeaders: ["*"],
      AllowedMethods: ["GET", "HEAD", "PUT"],
      AllowedOrigins: allowedOrigins,
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3600,
    }],
  },
}));

console.log(`Configured user-content CORS for: ${allowedOrigins.join(", ")}`);
