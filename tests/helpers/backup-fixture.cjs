// Use the application's stored-ZIP encoder only to package independent fixtures.
// Assertions in callers inspect HTTP results and persisted business data.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
const context = { Buffer, Date };
vm.createContext(context);
for (const name of ['crc32', 'dosDateTime', 'createZip']) {
  vm.runInContext(source.match(new RegExp('^function ' + name + '\\([^]*?^}', 'm'))[0], context);
}
function backupFixture(sections, entries) {
  return context.createZip({ 'manifest.json': JSON.stringify({ version: 1, collections: sections }), ...Object.fromEntries(Object.entries(entries).map(([key,value]) => [key, JSON.stringify(value)])) });
}
module.exports = { backupFixture };
