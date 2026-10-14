const fs = require('fs');
const path = require('path');

const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// Split semantic version (e.g., "1.2.8")
let versionParts = pkg.version.split('.');

// Increment the patch/build number
if (versionParts.length === 3) {
  versionParts[2] = parseInt(versionParts[2], 10) + 1;
}

pkg.version = versionParts.join('.');

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Build version bumped to v${pkg.version}`);