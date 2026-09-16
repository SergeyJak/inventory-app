const fs = require('fs');
const path = require('path');
const Module = require('module');

const corePath = path.join(__dirname, 'assistant-engine-v2-core.test.cjs');
const source = fs.readFileSync(corePath, 'utf8').replace(/assistant-engine\.js/g, 'assistant-engine-core.js');
const coreTest = new Module(corePath, module);
coreTest.filename = corePath;
coreTest.paths = module.paths;
coreTest._compile(source, corePath);
