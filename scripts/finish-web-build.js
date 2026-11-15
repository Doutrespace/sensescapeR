#!/usr/bin/env node
/**
 * Post-processing for static hosts such as GitHub Pages:
 *   - 404.html: a copy of index.html, so deep links (e.g. /auth/confirm from
 *     the sign-up email) load the app instead of a "not found" page.
 *   - .nojekyll: stops GitHub Pages from skipping folders that start with "_"
 *     (the bundle lives in _expo/).
 */
const fs = require('fs');
const path = require('path');

const dist = path.resolve(__dirname, '..', 'dist');
const index = path.join(dist, 'index.html');

if (!fs.existsSync(index)) {
  console.error('finish-web-build: dist/index.html not found - did the export fail?');
  process.exit(1);
}

fs.copyFileSync(index, path.join(dist, '404.html'));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log('finish-web-build: wrote 404.html and .nojekyll');
