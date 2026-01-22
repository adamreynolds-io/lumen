import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';

const watch = process.argv.includes('--watch');

// Ensure dist directory exists and copy manifest
mkdirSync('dist', { recursive: true });
copyFileSync('src/manifest.json', 'dist/manifest.json');
console.log('Copied manifest.json to dist/');

const buildOptions = {
  entryPoints: {
    'background': 'src/background/service-worker.ts',
  },
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  minify: false,
  logLevel: 'info',
};

async function build() {
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('Build complete');
  }
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
