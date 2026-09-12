/* global __dirname */
// Bundle the matching SQLite WASM locally, without a runtime CDN dependency.
const { copyFileSync, mkdirSync } = require('node:fs');
const { dirname, join } = require('node:path');
const packageRoot = dirname(dirname(require.resolve('sql.js')));
const target = join(__dirname, '..', 'public');
mkdirSync(target, { recursive: true });
copyFileSync(join(packageRoot, 'dist', 'sql-wasm-browser.wasm'), join(target, 'sql-wasm.wasm'));
