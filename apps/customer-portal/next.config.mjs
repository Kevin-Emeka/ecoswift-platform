import path from 'path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the workspace root explicitly — an unrelated package-lock.json in
  // the user's home directory (outside this repo) otherwise makes Next.js
  // mis-infer the root, which breaks module resolution and throws
  // "Cannot read properties of undefined (reading 'call')" at runtime.
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  reactStrictMode: true,
  transpilePackages: ['@ecoswift/ui', '@ecoswift/types', '@ecoswift/utils'],
  eslint: {
    dirs: ['app', 'components', 'hooks', 'lib', 'services'],
  },
};

export default nextConfig;
