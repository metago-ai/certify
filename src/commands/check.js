'use strict';

/**
 * check 命令
 * 检查单个或目录下所有 SKILL.md 文件是否符合认证标准。
 *
 * 用法：
 *   certify check <skill-path>        检查单个文件
 *   certify check --dir <skills-dir>  批量检查目录
 *   certify check <skill-path> --json 输出 JSON
 */

const fs = require('fs');
const path = require('path');
const { runAllChecks } = require('../lib/checker');
const { renderText, renderSummary, resultToJson, summaryToJson, C } = require('../lib/reporter');

/** SKILL.md 文件名约定 */
const SKILL_FILE_NAME = 'SKILL.md';

/**
 * 递归收集目录下所有 SKILL.md 文件
 * @param {string} dir
 * @returns {string[]}
 */
function collectSkillFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    // 跳过 node_modules 与隐藏目录，避免污染结果
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      results.push(...collectSkillFiles(full));
    } else if (entry.isFile() && entry.name === SKILL_FILE_NAME) {
      results.push(full);
    }
  }
  return results;
}

/**
 * 读取并检查单个文件
 * @param {string} filePath
 * @returns {{ result: Object, filePath: string, error?: string }}
 */
function checkFile(filePath) {
  try {
    const abs = path.resolve(filePath);
    if (!fs.existsSync(abs)) {
      return { result: null, filePath: abs, error: '文件不存在' };
    }
    const content = fs.readFileSync(abs, 'utf-8');
    const result = runAllChecks(content);
    return { result, filePath: abs };
  } catch (e) {
    return { result: null, filePath, error: e.message };
  }
}

/**
 * check 命令处理函数
 * @param {string[]} args - 去除命令名后的参数
 * @returns {number} 退出码（0 成功，1 存在未通过项）
 */
function run(args) {
  const opts = parseArgs(args);

  // 目录批量模式
  if (opts.dir) {
    const dirAbs = path.resolve(opts.dir);
    if (!fs.existsSync(dirAbs) || !fs.statSync(dirAbs).isDirectory()) {
      console.error(`错误: 目录不存在或不是目录: ${dirAbs}`);
      return 1;
    }
    const files = collectSkillFiles(dirAbs);
    if (files.length === 0) {
      console.error(`提示: 在 ${dirAbs} 下未找到任何 SKILL.md 文件`);
      return 1;
    }

    const entries = files
      .map((f) => checkFile(f))
      .filter((e) => e.result);

    if (opts.json) {
      console.log(JSON.stringify(summaryToJson(entries), null, 2));
    } else {
      console.log(renderSummary(entries));
      // 详细模式下逐个打印
      if (opts.verbose) {
        entries.forEach((e) => {
          console.log(renderText(e.result, e.filePath));
        });
      }
    }
    return entries.some((e) => !e.result.passed) ? 1 : 0;
  }

  // 单文件模式
  const target = opts.target;
  if (!target) {
    console.error('用法: certify check <skill-path>  或  certify check --dir <skills-dir>');
    return 1;
  }

  const { result, filePath, error } = checkFile(target);
  if (error || !result) {
    console.error(`检查失败: ${error || '未知错误'} (${filePath})`);
    return 1;
  }

  if (opts.json) {
    console.log(JSON.stringify(resultToJson(result, filePath), null, 2));
  } else {
    console.log(renderText(result, filePath));
  }
  return result.passed ? 0 : 1;
}

/**
 * 解析 check 子命令参数
 * @param {string[]} args
 */
function parseArgs(args) {
  const opts = { dir: null, target: null, json: false, verbose: false };
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') {
      opts.json = true;
    } else if (a === '--verbose' || a === '-v') {
      opts.verbose = true;
    } else if (a === '--dir' || a === '-d') {
      opts.dir = args[++i];
    } else if (a === '--help' || a === '-h') {
      opts.help = true;
    } else if (!a.startsWith('-')) {
      positional.push(a);
    }
  }
  opts.target = positional[0] || null;
  return opts;
}

/** 帮助文本 */
const HELP = `
检查技能是否符合 MetaGO 认证标准

用法:
  certify check <skill-path>            检查单个 SKILL.md
  certify c <skill-path>                使用别名 c
  certify check --dir <skills-dir>      批量检查目录下所有技能
  certify check <skill-path> --json     输出 JSON 格式报告
  certify check --dir <dir> --verbose   批量模式并打印逐项详情

选项:
  --dir, -d <path>    指定批量检查目录（递归扫描 SKILL.md）
  --json              以 JSON 格式输出
  --verbose, -v       批量模式下打印每个技能的详细报告
  --help, -h          显示本帮助

退出码:
  0  全部通过
  1  存在未通过项或参数错误
`.trim();

module.exports = { run, parseArgs, HELP, collectSkillFiles, checkFile };
