'use strict';

/**
 * certify 命令
 * 对技能进行正式认证：通过检查后生成 .certified.json 证书。
 *
 * 用法：
 *   certify certify <skill-path>
 *   certify certify <skill-path> --json
 */

const fs = require('fs');
const path = require('path');
const { runAllChecks } = require('../lib/checker');
const {
  buildCertificateFromChecks,
  writeCertificate,
  resolveCertPath,
} = require('../lib/cert-generator');
const { renderText, resultToJson, C } = require('../lib/reporter');
const { resolveLevel: resolveLevelStd } = require('../standards');

/**
 * certify 命令处理函数
 * @param {string[]} args
 * @returns {number} 退出码
 */
function run(args) {
  const opts = parseArgs(args);

  if (opts.help) {
    console.log(HELP);
    return 0;
  }

  if (!opts.target) {
    console.error('用法: certify certify <skill-path>');
    return 1;
  }

  const abs = path.resolve(opts.target);
  if (!fs.existsSync(abs)) {
    console.error(`错误: 文件不存在: ${abs}`);
    return 1;
  }

  let content;
  try {
    content = fs.readFileSync(abs, 'utf-8');
  } catch (e) {
    console.error(`读取文件失败: ${e.message}`);
    return 1;
  }

  const result = runAllChecks(content);

  // 即使未通过也先打印报告，便于定位问题
  if (!opts.json) {
    console.log(renderText(result, abs));
  }

  if (!result.passed) {
    const level = resolveLevelStd(result.score);
    console.error(
      `\n${C.red}认证未通过${C.reset}：当前等级 ${level.stars} ${level.level}（${result.score}/${result.maxScore}）。` +
        `需达到 Silver(5/6) 及以上方可颁发证书。\n` +
        `请修复以下未通过项：${result.checks
          .filter((c) => c.status === 'fail')
          .map((c) => c.code)
          .join(', ')}\n`,
    );
    if (opts.json) {
      console.log(JSON.stringify(resultToJson(result, abs), null, 2));
    }
    return 1;
  }

  // 通过认证，生成证书
  const certificate = buildCertificateFromChecks(result.skillName, result.checks);
  let certPath;
  try {
    certPath = writeCertificate(abs, certificate);
  } catch (e) {
    console.error(`写入证书失败: ${e.message}`);
    return 1;
  }

  if (opts.json) {
    console.log(
      JSON.stringify(
        { ...resultToJson(result, abs), certificate, certificatePath: certPath },
        null,
        2,
      ),
    );
  } else {
    const level = resolveLevelStd(result.score);
    console.log(
      `${C.green}认证成功${C.reset}  ${level.stars} ${level.level}（${level.desc}）\n` +
        `证书已写入: ${C.cyan}${certPath}${C.reset}\n`,
    );
  }
  return 0;
}

/**
 * 解析 certify 子命令参数
 * @param {string[]} args
 */
function parseArgs(args) {
  const opts = { target: null, json: false, help: false };
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') opts.json = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (!a.startsWith('-')) positional.push(a);
  }
  opts.target = positional[0] || null;
  return opts;
}

/** 帮助文本 */
const HELP = `
对技能进行正式认证（通过检查后颁发证书）

用法:
  certify certify <skill-path>          认证单个技能
  certify certify <skill-path> --json   输出 JSON 格式结果

说明:
  - 执行全部 6 项检查
  - 得分 >= 5（Silver）时，在 SKILL.md 同目录生成 .certified.json 证书
  - 得分 4 及以下不颁发证书，返回退出码 1

证书字段:
  skillName         技能名
  certifiedAt       认证时间（ISO 8601）
  score / maxScore  得分
  level             认证等级（Gold / Silver）
  standardVersion   认证标准版本
  checks            各检查项结果
`.trim();

module.exports = { run, parseArgs, HELP };
