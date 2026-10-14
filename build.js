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
  console.log(`\x1b[35m[Timer]\x1b[0m Build script started at ${new Date().toLocaleTimeString()}`);

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
    const platform = os.platform();
    const release = os.release();
    if (platform === 'win32') {
      const buildNum = parseInt(release.split('.')[2] || '0', 10);
      return buildNum >= 22000 ? 'W1' : 'W0';
    }
    if (platform === 'linux') return 'LX';
    if (platform === 'darwin') return 'MC';
    return 'OS';
  }

  const seqPair = pkg.buildCounter.toString(36).toUpperCase().padStart(5, '0');
  const hardwareCode = getHardwarePair();
  const osCode = getOsPair();
  let buildNumber = `${hardwareCode}${seqPair}-OpSys_${osCode}`;

  const customTag = process.argv[2];
  if (customTag) {
    const sanitizedTag = customTag.replace(/[^a-zA-Z0-9-_]/g, '').toUpperCase();
    buildNumber = `${buildNumber}-${sanitizedTag}`;
  }

  pkg.buildString = buildNumber;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  
  console.log(`\x1b[32m[Phase 1/3]\x1b[0m Generated build code: \x1b[33m#${buildNumber}\x1b[0m (Counter: ${pkg.buildCounter})`);

  const outDir = path.join('dist', buildNumber);
  
  // Use absolute system temp directory to prevent packager path conflicts
  const tmpDir = path.join(os.tmpdir(), 'focus-browser-tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const targets = [
    { platform: 'win32', arch: 'x64', appFolderName: 'FocusBrowser-win32-x64', icon: 'icon.ico' },
    { platform: 'darwin', arch: 'x64', appFolderName: 'FocusBrowser-darwin-x64', icon: 'icon.icns' }
  ];

  console.log(`\x1b[32m[Phase 2/3]\x1b[0m Packaging application for multiple platforms...`);

  try {
    for (const target of targets) {
      console.log(`\n\x1b[36m[Packager]\x1b[0m Building for platform: \x1b[33m${target.platform} (${target.arch})\x1b[0m`);
      
      let iconFlag = '';
      if (fs.existsSync(target.icon)) {
        iconFlag = `--icon=${target.icon}`;
      } else {
        console.log(`\x1b[33m[Warning]\x1b[0m Icon file '${target.icon}' not found. Building without custom icon for ${target.platform}.`);
      }

      const packagerCmd = `npx electron-packager . FocusBrowser --platform=${target.platform} --arch=${target.arch} ${iconFlag} --out="${outDir}" --tmpdir="${tmpDir}" --ignore="dist" --overwrite`;

      execSync(packagerCmd, { stdio: 'inherit' });
      
      const targetBuildFolder = path.join(outDir, target.appFolderName);
      console.log(`\x1b[32m[Success]\x1b[0m Packaged ${target.platform} at: ${targetBuildFolder}`);
      
      console.log(`\x1b[32m[Phase 3/3]\x1b[0m Compressing ${target.platform} build to ZIP...`);
      const zipOutputName = path.join(outDir, `${pkg.name}-${buildNumber}-${target.platform}-${target.arch}.zip`);
      await compressToZip(targetBuildFolder, zipOutputName);
    }

    const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n\x1b[35m[Timer]\x1b[0m All builds complete! Total time elapsed: \x1b[33m${totalSeconds}s\x1b[0m`);
  } catch (error) {
    console.error('\x1b[31m[Error]\x1b[0m Process failed:', error.message);
    process.exit(1);
  }
}

main();