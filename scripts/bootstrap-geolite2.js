const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pipeline } = require('stream/promises');

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

function safeUrlForLog(url) {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('license_key')) parsed.searchParams.set('license_key', '[redacted]');
    return parsed.toString();
  } catch {
    return '[invalid-url]';
  }
}

function request(url) {
  return new Promise((resolve, reject) => {
    https.get(url, response => {
      resolve(response);
    }).on('error', reject);
  });
}

async function download(url, destination, redirects = 0) {
  if (redirects > 5) throw new Error('too many redirects');
  const response = await request(url);
  const status = response.statusCode || 0;
  if ([301, 302, 303, 307, 308].includes(status)) {
    response.resume();
    if (!response.headers.location) throw new Error(`HTTP ${status} redirect without location`);
    const nextUrl = new URL(response.headers.location, url).toString();
    log(`Download redirected with HTTP ${status}`);
    return download(nextUrl, destination, redirects + 1);
  }
  if (status !== 200) {
    response.resume();
    throw new Error(`download failed with HTTP ${status} from ${safeUrlForLog(url)}`);
  }
  fs.rmSync(destination, { force: true });
  try {
    await pipeline(response, fs.createWriteStream(destination, { flags: 'wx' }));
  } catch (err) {
    fs.rmSync(destination, { force: true });
    throw new Error(`download stream failed: ${err.message}`);
  }
  const size = fs.statSync(destination).size;
  if (size <= 0) {
    fs.rmSync(destination, { force: true });
    throw new Error('download produced an empty archive');
  }
  log(`Downloaded archive (${Math.round(size / 1024)} KB)`);
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
  try {
    const archive = path.join(tmpDir, `${database.edition}.tar.gz`);
    const url = `https://download.maxmind.com/app/geoip_download?edition_id=${encodeURIComponent(database.edition)}&license_key=${encodeURIComponent(licenseKey)}&suffix=tar.gz`;
    await download(url, archive);
    if (!fs.existsSync(archive)) throw new Error('download did not create archive');
    const extracted = spawnSync('tar', ['-xzf', archive, '-C', tmpDir], { stdio: 'pipe' });
    if (extracted.status !== 0) {
      throw new Error(`extraction failed: ${extracted.stderr.toString().trim() || extracted.status}`);
    }
    const source = findFile(tmpDir, `${database.edition}.mmdb`);
    if (!source) throw new Error(`${database.edition}.mmdb not found in archive`);
    fs.copyFileSync(source, database.target);
    return true;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
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
