import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');
const publicDir = path.join(root, 'public');

await mkdir(publicDir, { recursive: true });
await rm(path.join(publicDir, 'assets'), { recursive: true, force: true });
await rm(path.join(publicDir, 'index.html'), { force: true });
await cp(dist, publicDir, { recursive: true, force: true });
