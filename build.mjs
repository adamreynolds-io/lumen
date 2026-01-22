import * as esbuild from 'esbuild';
import { copyFileSync, cpSync, mkdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

// Ensure dist directories exist
mkdirSync('dist', { recursive: true });
mkdirSync('dist/popup', { recursive: true });

// Copy static files
copyFileSync('src/manifest.json', 'dist/manifest.json');
copyFileSync('src/popup/popup.html', 'dist/popup/popup.html');
copyFileSync('src/popup/popup.css', 'dist/popup/popup.css');
console.log('Copied static files to dist/');

/**
 * Plugin to handle WASM files for wasm-bindgen modules.
 *
 * wasm-bindgen uses a complex initialization pattern:
 * - bg.js exports functions that call into WASM
 * - snippet files import from '#self' which refers to WASM exports
 * - WASM imports from both bg.js and snippets
 *
 * To break this circular dependency, we:
 * 1. Create a mutable exports object
 * 2. Create wrapper functions for snippet imports that defer to the exports
 * 3. Instantiate WASM with these wrappers
 * 4. Populate the exports object
 */
const wasmPlugin = {
  name: 'wasm',
  setup(build) {
    // Intercept the wasm-bindgen entry file (midnight_ledger_wasm.js)
    // to prevent duplicate initialization
    build.onLoad({ filter: /midnight_ledger_wasm\.js$/ }, async (args) => {
      const wasmDir = dirname(args.path);
      const bgJsPath = resolve(wasmDir, 'midnight_ledger_wasm_bg.js');
      const wasmPath = resolve(wasmDir, 'midnight_ledger_wasm_bg.wasm');

      // Read and process the WASM file here instead
      const wasmBuffer = readFileSync(wasmPath);
      const base64 = wasmBuffer.toString('base64');

      // Analyze WASM imports
      const wasmModule = new WebAssembly.Module(wasmBuffer);
      const wasmImports = WebAssembly.Module.imports(wasmModule);

      // Group imports by module
      const importsByModule = new Map();
      wasmImports.forEach(imp => {
        if (!importsByModule.has(imp.module)) {
          importsByModule.set(imp.module, []);
        }
        importsByModule.get(imp.module).push(imp.name);
      });

      console.log(`Processing WASM via entry: midnight_ledger_wasm_bg.wasm (${(wasmBuffer.length / 1024 / 1024).toFixed(1)}MB)`);

      // Find bg.js module name
      const bgJsModuleName = [...importsByModule.keys()].find(m => m.endsWith('_bg.js'));

      // Build snippet wrapper functions
      const snippetCode = [];
      const importObjectEntries = [];

      for (const [moduleName, funcNames] of importsByModule) {
        if (moduleName.endsWith('_bg.js')) {
          importObjectEntries.push(`${JSON.stringify(moduleName)}: bgModule`);
        } else {
          // Snippet files
          const snippetPath = resolve(wasmDir, moduleName);
          const snippetSrc = readFileSync(snippetPath, 'utf-8');
          const funcMatch = snippetSrc.match(/export function (\w+)\(\)/);
          if (funcMatch) {
            const funcName = funcMatch[1];
            snippetCode.push(`const ${funcName} = () => globalThis.__wasmExports.${funcName.replace(/_$/, '')};`);
            importObjectEntries.push(`${JSON.stringify(moduleName)}: { ${funcName} }`);
          }
        }
      }

      return {
        contents: `
import * as bgModule from ${JSON.stringify(bgJsPath)};

// Initialize global exports holder
globalThis.__wasmExports = {};

${snippetCode.join('\n')}

// Decode base64 WASM
const wasmBase64 = "${base64}";
const wasmBytes = Uint8Array.from(atob(wasmBase64), c => c.charCodeAt(0));

// Compile WASM module synchronously
const wasmModule = new WebAssembly.Module(wasmBytes);

// Build imports object
const imports = {
  ${importObjectEntries.join(',\n  ')}
};

// Instantiate with imports
const wasmInstance = new WebAssembly.Instance(wasmModule, imports);

// Set the global exports for snippet functions
globalThis.__wasmExports = wasmInstance.exports;

// Set the wasm reference in bg.js
bgModule.__wbg_set_wasm(wasmInstance.exports);

// Initialize wasm-bindgen internals
if (typeof bgModule.__wbindgen_init_externref_table === 'function') {
  bgModule.__wbindgen_init_externref_table();
}

// Re-export everything from bg.js (the public API)
export * from ${JSON.stringify(bgJsPath)};
`,
        loader: 'js',
        resolveDir: wasmDir,
      };
    });

    // Handle .wasm imports (fallback for other WASM files)
    build.onResolve({ filter: /\.wasm$/ }, (args) => {
      return {
        path: resolve(args.resolveDir, args.path),
        namespace: 'wasm-bindgen',
        pluginData: { resolveDir: args.resolveDir },
      };
    });

    build.onLoad({ filter: /.*/, namespace: 'wasm-bindgen' }, async (args) => {
      const wasmBuffer = readFileSync(args.path);
      const base64 = wasmBuffer.toString('base64');
      const wasmDir = dirname(args.path);

      // Find the corresponding bg.js file
      const bgJsPath = args.path.replace('.wasm', '.js');

      // Analyze WASM imports to find all required modules
      const wasmModule = new WebAssembly.Module(wasmBuffer);
      const wasmImports = WebAssembly.Module.imports(wasmModule);

      // Group imports by module and function name
      const importsByModule = new Map();
      wasmImports.forEach(imp => {
        if (!importsByModule.has(imp.module)) {
          importsByModule.set(imp.module, []);
        }
        importsByModule.get(imp.module).push(imp.name);
      });

      console.log(`Processing WASM: ${args.path.split('/').pop()} (${(wasmBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
      console.log(`  Import modules: ${importsByModule.size}`);

      // Build import statements - only import bg.js directly
      // Snippets need special handling due to #self circular dependency
      const bgJsModuleName = [...importsByModule.keys()].find(m => m.endsWith('_bg.js'));
      if (!bgJsModuleName) {
        throw new Error('Could not find bg.js module in WASM imports');
      }

      // Read snippet files and inline them with #self resolved
      const snippetCode = [];
      const importObjectEntries = [];

      for (const [moduleName, funcNames] of importsByModule) {
        if (moduleName.endsWith('_bg.js')) {
          // bg.js is imported normally
          importObjectEntries.push(`${JSON.stringify(moduleName)}: bgModule`);
        } else {
          // Snippet files - read and transform
          const snippetPath = resolve(wasmDir, moduleName);
          let snippetSrc = readFileSync(snippetPath, 'utf-8');

          // Replace #self import with reference to wasmExports
          snippetSrc = snippetSrc.replace(
            /import \* as wasm from ['"]#self['"];?/,
            'const wasm = globalThis.__wasmExports;'
          );

          // Extract the exported function
          const funcMatch = snippetSrc.match(/export function (\w+)\(\)/);
          if (funcMatch) {
            const funcName = funcMatch[1];
            snippetCode.push(`
// From ${moduleName}
const ${funcName} = () => {
  const wasm = globalThis.__wasmExports;
  return wasm.${funcName.replace(/_$/, '')};
};`);
            importObjectEntries.push(`${JSON.stringify(moduleName)}: { ${funcName} }`);
          }
        }
      }

      return {
        contents: `
import * as bgModule from ${JSON.stringify(resolve(wasmDir, bgJsModuleName))};

// Initialize global exports holder
globalThis.__wasmExports = {};

${snippetCode.join('\n')}

// Decode base64 WASM
const wasmBase64 = "${base64}";
const wasmBytes = Uint8Array.from(atob(wasmBase64), c => c.charCodeAt(0));

// Compile WASM module synchronously
const wasmModule = new WebAssembly.Module(wasmBytes);

// Build imports object
const imports = {
  ${importObjectEntries.join(',\n  ')}
};

// Instantiate with imports
const wasmInstance = new WebAssembly.Instance(wasmModule, imports);

// Set the global exports for snippet functions
globalThis.__wasmExports = wasmInstance.exports;

// Set the wasm reference in bg.js
bgModule.__wbg_set_wasm(wasmInstance.exports);

// Initialize wasm-bindgen internals
if (typeof bgModule.__wbindgen_init_externref_table === 'function') {
  bgModule.__wbindgen_init_externref_table();
}

// Export everything from the instance
export default wasmInstance.exports;
export * from ${JSON.stringify(bgJsPath)};
`,
        loader: 'js',
        resolveDir: wasmDir,
      };
    });
  },
};

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
  plugins: [wasmPlugin],
  // Polyfill Node.js built-ins for browser
  define: {
    'process.env.NODE_ENV': '"production"',
    'global': 'globalThis',
  },
  // Inject polyfills for Node.js modules
  inject: [resolve(__dirname, 'src/polyfills.js')],
  // Alias Node.js built-ins to browser-compatible versions
  alias: {
    'assert': 'assert',
    'crypto': 'crypto-browserify',
    'stream': 'stream-browserify',
    'buffer': 'buffer',
    'util': 'util',
    'process': 'process/browser',
  },
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
