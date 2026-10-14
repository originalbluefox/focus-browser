const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const pkgPath = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const archiver = require('archiver');

function compressToZip(input, output) {
  return new Promise((resolve, reject) => {
    if (!input) return reject(new Error("No input dir"));
    
    const absoluteInputPath = path.resolve(input);
    if (!fs.existsSync(absoluteInputPath)) {
      return reject(new Error(`Invalid Input Directory, path does not exist: ${absoluteInputPath}`));
    }
    
    if (!output) {
      output = path.join(path.dirname(absoluteInputPath), `${pkg.name}-${pkg.buildString || Date.now()}.zip`);
    }

    output = path.resolve(output);

    console.log(`\x1b[36m[Archiver]\x1b[0m Initializing ZIP compression -> \x1b[33m${path.basename(output)}\x1b[0m`);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    const outputStream = fs.createWriteStream(output);

    archive.on('progress', (progress) => {
      process.stdout.write(`\r\x1b[36m[Archiver]\x1b[0m Zipping... Processed ${progress.fs.processedBytes} bytes`);
    });

    outputStream.on('close', function () {
      process.stdout.write('\n');
      console.log(`\x1b[32m[Success]\x1b[0m Archive created: \x1b[33m${output}\x1b[0m (${archive.pointer()} total bytes)`);
      resolve(output);
    });

    archive.on('error', function (err) {
      reject(err);
    });

    outputStream.on('error', function (err) {
      reject(err);
    });

    archive.pipe(outputStream);
    archive.directory(absoluteInputPath, false);
    archive.finalize();
  });
}

async function main() {
  const startTime = Date.now();
  
  // Accept target platform from CLI arguments (defaults to win32 if not specified)
  const targetPlatform = process.argv[2] || 'win32';
  const targetArch = 'x64';
  const appFolderName = targetPlatform === 'win32' ? 'FocusBrowser-win32-x64' : 'FocusBrowser-darwin-x64';
  const iconFile = targetPlatform === 'win32' ? 'icon.ico' : 'icon.icns';

  console.log(`\x1b[35m[Timer]\x1b[0m Build script started for \x1b[33m${targetPlatform}\x1b[0m at ${new Date().toLocaleTimeString()}`);

  pkg.buildCounter = (pkg.buildCounter || 0) + 1;

  function getHardwarePair() {
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model.toUpperCase() : '';
    if (cpuModel.includes('AMD')) return 'AM';
    if (cpuModel.includes('INTEL')) return 'IN';
    if (process.arch === 'arm64' || process.arch === 'arm') return 'AR';
    return 'X8';
  }

  function getOsPair() {
    if (targetPlatform === 'win32') return 'W1';
    if (targetPlatform === 'darwin') return 'MC';
    return 'OS';
  }

  const seqPair = pkg.buildCounter.toString(36).toUpperCase().padStart(5, '0');
  const hardwareCode = getHardwarePair();
  const osCode = getOsPair();
  let buildNumber = `${hardwareCode}${seqPair}-OpSys_${osCode}`;

  const customTag = process.argv[3];
  if (customTag) {
    const sanitizedTag = customTag.replace(/[^a-zA-Z0-9-_]/g, '').toUpperCase();
    buildNumber = `${buildNumber}-${sanitizedTag}`;
  }

  pkg.buildString = buildNumber;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  
  console.log(`\x1b[32m[Phase 1/3]\x1b[0m Generated build code: \x1b[33m#${buildNumber}\x1b[0m (Counter: ${pkg.buildCounter})`);

  const outDir = path.join('dist', buildNumber);
  const tmpDir = path.join(os.tmpdir(), 'focus-browser-tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  console.log(`\x1b[32m[Phase 2/3]\x1b[0m Packaging application for \x1b[33m${targetPlatform} (${targetArch})\x1b[0m...`);

  try {
    let iconFlag = '';
    if (fs.existsSync(iconFile)) {
      iconFlag = `--icon=${iconFile}`;
    } else {
      console.log(`\x1b[33m[Warning]\x1b[0m Icon file '${iconFile}' not found. Building without custom icon.`);
    }

    const packagerCmd = `npx electron-packager . FocusBrowser --platform=${targetPlatform} --arch=${targetArch} ${iconFlag} --out="${outDir}" --tmpdir="${tmpDir}" --ignore="dist" --overwrite`;

    execSync(packagerCmd, { stdio: 'inherit' });
    
    const targetBuildFolder = path.join(outDir, appFolderName);
    console.log(`\x1b[32m[Success]\x1b[0m Packaged at: ${targetBuildFolder}`);
    
    console.log(`\x1b[32m[Phase 3/3]\x1b[0m Compressing build folder to ZIP...`);
    const zipOutputName = path.join(outDir, `${pkg.name}-${buildNumber}-${targetPlatform}-${targetArch}.zip`);
    await compressToZip(targetBuildFolder, zipOutputName);

    const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n\x1b[35m[Timer]\x1b[0m Build complete! Total time elapsed: \x1b[33m${totalSeconds}s\x1b[0m`);
  } catch (error) {
    console.error('\x1b[31m[Error]\x1b[0m Process failed:', error.message);
    process.exit(1);
  }
}

main();