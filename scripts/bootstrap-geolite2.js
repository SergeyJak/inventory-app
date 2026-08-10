const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const GEO_DIR = process.env.GEOLITE2_DIR || '/data/geoip';
const DATABASES = [
  { edition: 'GeoLite2-City', target: process.env.GEOLITE2_CITY_DB || path.join(GEO_DIR, 'GeoLite2-City.mmdb') },
  { edition: 'GeoLite2-ASN', target: process.env.GEOLITE2_ASN_DB || path.join(GEO_DIR, 'GeoLite2-ASN.mmdb') },
];

function log(message) {
  console.log(`[geoip] ${message}`);
}

function warn(message) {
  console.warn(`[geoip] ${message}`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    https.get(url, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        file.close(() => fs.rmSync(destination, { force: true }));
        download(response.headers.location, destination).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close(() => fs.rmSync(destination, { force: true }));
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      file.close(() => fs.rmSync(destination, { force: true }));
      reject(err);
    });
  });
}

function findFile(root, filename) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(fullPath, filename);
      if (found) return found;
    } else if (entry.name === filename) {
      return fullPath;
    }
  }
  return '';
}

async function provisionDatabase(database, licenseKey) {
  if (fs.existsSync(database.target)) return false;
  ensureDir(path.dirname(database.target));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `${database.edition}-`));
  const archive = path.join(tmpDir, `${database.edition}.tar.gz`);
  const url = `https://download.maxmind.com/app/geoip_download?edition_id=${encodeURIComponent(database.edition)}&license_key=${encodeURIComponent(licenseKey)}&suffix=tar.gz`;
  await download(url, archive);
  const extracted = spawnSync('tar', ['-xzf', archive, '-C', tmpDir], { stdio: 'pipe' });
  if (extracted.status !== 0) {
    throw new Error(`tar failed: ${extracted.stderr.toString().trim() || extracted.status}`);
  }
  const source = findFile(tmpDir, `${database.edition}.mmdb`);
  if (!source) throw new Error(`${database.edition}.mmdb not found in archive`);
  fs.copyFileSync(source, database.target);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return true;
}

async function main() {
  const missing = DATABASES.filter(database => !fs.existsSync(database.target));
  if (!missing.length) {
    log('GeoLite2 databases already present.');
    return;
  }
  if (!process.env.MAXMIND_LICENSE_KEY) {
    warn('MAXMIND_LICENSE_KEY is not set; GeoLite2 databases will be unavailable until provisioned.');
    return;
  }
  for (const database of missing) {
    try {
      const downloaded = await provisionDatabase(database, process.env.MAXMIND_LICENSE_KEY);
      if (downloaded) log(`Downloaded ${database.edition} to ${database.target}`);
    } catch (err) {
      warn(`Could not provision ${database.edition}: ${err.message}`);
    }
  }
}

main().catch(err => {
  warn(`GeoLite2 bootstrap skipped: ${err.message}`);
});
