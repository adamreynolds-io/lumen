import * as esbuild from 'esbuild';
import { copyFileSync, cpSync, mkdirSync } from 'fs';

const watch = process.argv.includes('--watch');

// Ensure dist directories exist
mkdirSync('dist', { recursive: true });
mkdirSync('dist/popup', { recursive: true });

// Copy static files
copyFileSync('src/manifest.json', 'dist/manifest.json');
copyFileSync('src/popup/popup.html', 'dist/popup/popup.html');
copyFileSync('src/popup/popup.css', 'dist/popup/popup.css');
console.log('Copied static files to dist/');

const buildOptions = {
  entryPoints: {
    'background': 'src/background/service-worker.ts',
    'content': 'src/content/content.ts',
    'inject': 'src/inject/inject.ts',
    'popup/popup': 'src/popup/popup.ts',
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
