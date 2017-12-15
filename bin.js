#!/usr/bin/env node
'use strict';
const main = require('./index.js');

async function f() {
  await main(process.argv[2]);
}

f();
