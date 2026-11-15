#!/usr/bin/env node
/**
 * Copies the WebAssembly runtimes the web build loads at runtime into
 * `public/`, which Expo serves from the site root:
 *   public/sqljs/   - SQLite (sql.js) for the local recordings database
 *   public/litert/  - LiteRT.js (TFLite) for on-device sound/photo models
 *
 * Runs automatically before `npm run web` and `npm run build:web`.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const copies = [
  {
    from: 'node_modules/sql.js/dist',
    to: 'public/sqljs',
    files: ['sql-wasm-browser.wasm'],
  },
  {
    from: 'node_modules/@litertjs/core/wasm',
    to: 'public/litert',
    // Plain and compatibility builds. The threaded/JSPI builds need response
    // headers that static hosts such as GitHub Pages cannot set.
    files: [
      'litert_wasm_internal.js',
      'litert_wasm_internal.wasm',
      'litert_wasm_compat_internal.js',
      'litert_wasm_compat_internal.wasm',
    ],
  },
];

for (const { from, to, files } of copies) {
  const targetDir = path.join(root, to);
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of files) {
    const source = path.join(root, from, file);
    if (!fs.existsSync(source)) {
      console.error(`prepare-web: missing ${path.join(from, file)} - run "npm install" first.`);
      process.exit(1);
    }
    fs.copyFileSync(source, path.join(targetDir, file));
  }
  console.log(`prepare-web: ${files.length} file(s) -> ${to}`);
}
