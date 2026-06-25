'use strict';

/**
 * version 命令
 * 显示 certify 版本号与认证标准版本号。
 */

const pkg = require('../../package.json');
const { STANDARD_VERSION } = require('../standards');
const { C } = require('../lib/reporter');

/**
 * version 命令处理函数
 * @param {string[]} _args
 * @returns {number}
 */
function run(_args) {
  const lines = [];
  lines.push(`${C.bold}${C.magenta}@metago-ai/certify${C.reset} v${pkg.version}`);
  lines.push(`${C.gray}认证标准版本: ${STANDARD_VERSION}${C.reset}`);
  lines.push(`${C.gray}Node.js: ${process.version}${C.reset}`);
  lines.push(`${C.gray}协议: MIT${C.reset}`);
  console.log(lines.join('\n'));
  return 0;
}

/** 帮助文本 */
const HELP = `
显示版本号

用法:
  certify version
  certify --version
  certify -V
`.trim();

module.exports = { run, HELP };
