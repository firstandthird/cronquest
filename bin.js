#!/usr/bin/env node
'use strict';
const main = require('./index.js');

async function f() {
  try {
    await main(process.argv[2]);
  } catch (e) {
    console.log(e);
  }
}

f();
