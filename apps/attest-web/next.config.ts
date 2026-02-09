import type { NextConfig } from 'next';

const requiredEnvVars = [
  'NEAR_ACCOUNT_ID',
  'NEAR_PRIVATE_KEY',
  'BLOB_READ_WRITE_TOKEN',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

const nextConfig: NextConfig = {
  /** nextjs config */
};

export default nextConfig;
