/**
 * Browser polyfills for Node.js built-ins
 * These are injected into the bundle by esbuild
 */

// Simple process shim for browser
globalThis.process = globalThis.process || {
  env: { NODE_ENV: 'production' },
  browser: true,
  version: '',
  versions: {},
  platform: 'browser',
  nextTick: (fn, ...args) => setTimeout(() => fn(...args), 0),
  cwd: () => '/',
  hrtime: (prev) => {
    const time = Date.now();
    if (!prev) return [Math.floor(time / 1000), (time % 1000) * 1e6];
    const prevMs = prev[0] * 1000 + prev[1] / 1e6;
    const diff = time - prevMs;
    return [Math.floor(diff / 1000), (diff % 1000) * 1e6];
  },
};

// Buffer polyfill
import { Buffer as BufferPolyfill } from 'buffer';
globalThis.Buffer = globalThis.Buffer || BufferPolyfill;
