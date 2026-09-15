#!/usr/bin/env node
/**
 * Local smoke: domain coverage is run via `npm run smoke`.
 * This script optionally hits live Vercel with VERCEL_TOKEN from .env
 * (never prints the token or env values).
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadToken() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return process.env.VERCEL_TOKEN ?? null;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    if (line.startsWith('VERCEL_TOKEN=')) return line.slice('VERCEL_TOKEN='.length).trim();
  }
  return process.env.VERCEL_TOKEN ?? null;
}

const token = loadToken();
if (!token) {
  console.log('smoke-local: no VERCEL_TOKEN; skipping live API checks.');
  process.exit(0);
}

const headers = { Authorization: `Bearer ${token}` };
const userRes = await fetch('https://api.vercel.com/v2/user', { headers });
if (!userRes.ok) {
  console.error(`smoke-local: /v2/user failed (${userRes.status})`);
  process.exit(1);
}
const userJson = await userRes.json();
const username = userJson?.user?.username ?? userJson?.username ?? 'unknown';

const projectsRes = await fetch('https://api.vercel.com/v10/projects?limit=5', { headers });
if (!projectsRes.ok) {
  console.error(`smoke-local: /v10/projects failed (${projectsRes.status})`);
  process.exit(1);
}
const projectsJson = await projectsRes.json();
const projects = Array.isArray(projectsJson) ? projectsJson : projectsJson.projects ?? [];
console.log(
  `smoke-local: ok user=${username} projects_sample=${projects.length}`,
);
