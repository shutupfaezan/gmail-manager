// postbuild.cjs
// Copies dist/index.html to dist/404.html after Vite build for SPA routing support on static hosts.

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const indexFile = path.join(distDir, 'index.html');
const notFoundFile = path.join(distDir, '404.html');

fs.copyFileSync(indexFile, notFoundFile);
console.log('Copied index.html to 404.html for SPA fallback.');
