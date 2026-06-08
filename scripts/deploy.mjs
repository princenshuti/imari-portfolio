#!/usr/bin/env node
// Deploy dist/ to cPanel over FTP(S).
// Reads credentials from .env.deploy (gitignored). Run via: npm run deploy
//
// Required keys in .env.deploy:
//   FTP_HOST=ftp.yourdomain.com
//   FTP_USER=your-ftp-user
//   FTP_PASSWORD=your-ftp-password
// Optional:
//   FTP_PORT=21            (default 21)
//   FTP_SECURE=true        (FTPS over explicit TLS; set false for plain FTP)
//   FTP_REMOTE_DIR=/       (document root for the subdomain, relative to FTP home)

import { Client } from 'basic-ftp';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env.deploy');
const distDir = join(root, 'dist');

// ── Load .env.deploy ────────────────────────────────────────────────
if (!existsSync(envPath)) {
  console.error('✗ Missing .env.deploy — copy scripts/deploy.env.example to .env.deploy and fill it in.');
  process.exit(1);
}
const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const { FTP_HOST, FTP_USER, FTP_PASSWORD } = env;
const FTP_PORT = Number(env.FTP_PORT || 21);
const FTP_SECURE = (env.FTP_SECURE ?? 'true').toLowerCase() !== 'false';
const FTP_REMOTE_DIR = env.FTP_REMOTE_DIR || '/';

if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
  console.error('✗ .env.deploy must set FTP_HOST, FTP_USER and FTP_PASSWORD.');
  process.exit(1);
}
if (!existsSync(distDir)) {
  console.error('✗ dist/ not found — run `npm run build` first (npm run deploy does this for you).');
  process.exit(1);
}

// ── Upload ──────────────────────────────────────────────────────────
const client = new Client(30_000);
client.ftp.verbose = false;
try {
  console.log(`→ Connecting to ${FTP_HOST}:${FTP_PORT} (${FTP_SECURE ? 'FTPS' : 'FTP'}) as ${FTP_USER}`);
  await client.access({
    host: FTP_HOST,
    port: FTP_PORT,
    user: FTP_USER,
    password: FTP_PASSWORD,
    secure: FTP_SECURE,
    secureOptions: { rejectUnauthorized: false }, // cPanel self/shared certs
  });
  console.log(`→ Uploading dist/ → ${FTP_REMOTE_DIR}`);
  client.trackProgress((info) => {
    if (info.name) process.stdout.write(`   ${info.type} ${info.name}\n`);
  });
  await client.ensureDir(FTP_REMOTE_DIR);
  await client.uploadFromDir(distDir, FTP_REMOTE_DIR);
  client.trackProgress();
  console.log('✓ Deploy complete.');
} catch (err) {
  console.error('✗ Deploy failed:', err.message);
  process.exitCode = 1;
} finally {
  client.close();
}
