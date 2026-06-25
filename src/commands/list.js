'use strict';

/**
 * list 命令
 * 列出当前目录（或指定目录）下所有已认证技能（扫描 .certified.json）。
 *
 * 用法：
 *   certify list                 扫描当前目录
 *   certify list <dir>           扫描指定目录
 *   certify list --json          JSON 输出
 */

const fs = require('fs');
const path = require('path');
const { readCertificate } = require('../lib/cert-generator');
const { C } = require('../lib/reporter');
const { resolveLevel } = require('../standards');

/** 证书文件名约定 */
const CERT_FILE_NAME = '.certified.json';

/**
 * 递归收集目录下所有 .certified.json 文件
 * @param {string} dir
 * @returns {string[]}
 */
function collectCertFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
      results.push(...collectCertFiles(full));
    } else if (entry.isFile() && entry.name === CERT_FILE_NAME) {
      results.push(full);
    }
  }
  return results;
}

/**
 * list 命令处理函数
 * @param {string[]} args
 * @returns {number}
 */
function run(args) {
  const opts = parseArgs(args);
  if (opts.help) {
    console.log(HELP);
    return 0;
  }

  const base = opts.dir ? path.resolve(opts.dir) : process.cwd();
  if (!fs.existsSync(base)) {
    console.error(`错误: 目录不存在: ${base}`);
    return 1;
  }

  const files = collectCertFiles(base);
  const items = [];
  for (const f of files) {
    const { valid, certificate, error } = readCertificate(f);
    if (valid && certificate) {
      items.push({ filePath: f, certificate });
    } else if (opts.verbose) {
      console.error(`${C.yellow}跳过无效证书${C.reset}: ${f} (${error})`);
    }
  }

  // 按技能名排序，便于浏览
  items.sort((a, b) => a.certificate.skillName.localeCompare(b.certificate.skillName));

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          total: items.length,
          items: items.map((i) => ({
            ...i.certificate,
            filePath: i.filePath,
          })),
        },
        null,
        2,
      ),
    );
    return 0;
  }

  if (items.length === 0) {
    console.log(`\n  ${C.gray}未在 ${base} 下发现任何已认证技能（.certified.json）${C.reset}\n`);
    return 0;
  }

  const lines = [];
  lines.push('');
  lines.push(`${C.bold}${C.magenta}╭──────────────────────────────────────────────╮${C.reset}`);
  lines.push(`${C.bold}${C.magenta}│${C.reset}  ${C.bold}MetaGO 已认证技能列表${C.reset}  （${items.length} 个）             ${C.bold}${C.magenta}│${C.reset}`);
  lines.push(`${C.bold}${C.magenta}╰──────────────────────────────────────────────╯${C.reset}`);
  lines.push('');
  const gold = items.filter((i) => i.certificate.level === 'Gold').length;
  const silver = items.filter((i) => i.certificate.level === 'Silver').length;
  lines.push(`  ${C.gray}Gold ${gold}  /  Silver ${silver}${C.reset}`);
  lines.push(`  ${C.gray}${'─'.repeat(44)}${C.reset}`);

  items.forEach((it) => {
    const cert = it.certificate;
    const level = resolveLevel(cert.score);
    const icon = cert.level === 'Gold' ? `${C.yellow}★${C.reset}` : `${C.cyan}☆${C.reset}`;
    const name = cert.skillName.padEnd(28);
    const score = `${cert.score}/${cert.maxScore}`;
    const date = (cert.certifiedAt || '').slice(0, 10);
    lines.push(
      `  ${icon}  ${name} ${score.padStart(5)}  ${level.stars}  ${C.gray}${date}${C.reset}`,
    );
  });
  lines.push('');
  console.log(lines.join('\n'));
  return 0;
}

/**
 * 解析 list 子命令参数
 * @param {string[]} args
 */
function parseArgs(args) {
  const opts = { dir: null, json: false, verbose: false, help: false };
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') opts.json = true;
    else if (a === '--verbose' || a === '-v') opts.verbose = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (!a.startsWith('-')) positional.push(a);
  }
  opts.dir = positional[0] || null;
  return opts;
}

/** 帮助文本 */
const HELP = `
列出已认证技能（扫描 .certified.json）

用法:
  certify list                 扫描当前目录
  certify list <dir>           扫描指定目录
  certify list --json          JSON 格式输出
  certify list --verbose       显示无效证书的跳过原因
`.trim();

module.exports = { run, parseArgs, HELP, collectCertFiles };
