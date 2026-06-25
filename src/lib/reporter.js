'use strict';

/**
 * 报告生成器
 *
 * 将检查结果格式化为文本或 JSON 输出。
 * 文本模式支持彩色终端输出（自动检测 TTY 与 NO_COLOR 环境变量）。
 */

const { CHECK_ITEMS, LEVEL_RULES, resolveLevel } = require('../standards');

/**
 * 终端颜色工具（仅在 TTY 且未禁用颜色时生效）
 */
const colorEnabled = (() => {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR === '0') return false;
  const stdout = process.stdout;
  return !!(stdout && stdout.isTTY);
})();

const C = {
  reset: colorEnabled ? '\x1b[0m' : '',
  bold: colorEnabled ? '\x1b[1m' : '',
  dim: colorEnabled ? '\x1b[2m' : '',
  red: colorEnabled ? '\x1b[31m' : '',
  green: colorEnabled ? '\x1b[32m' : '',
  yellow: colorEnabled ? '\x1b[33m' : '',
  blue: colorEnabled ? '\x1b[34m' : '',
  magenta: colorEnabled ? '\x1b[35m' : '',
  cyan: colorEnabled ? '\x1b[36m' : '',
  gray: colorEnabled ? '\x1b[90m' : '',
};

/**
 * 将单个技能的检查结果格式化为 JSON 结构
 *
 * @param {Object} result - runAllChecks 返回的结果
 * @param {string} [filePath] - 文件路径
 * @returns {Object}
 */
function resultToJson(result, filePath) {
  const checks = {};
  result.checks.forEach((c) => {
    checks[c.code] = {
      name: c.name,
      status: c.status,
      messages: c.messages,
      locations: c.locations,
    };
  });
  const level = resolveLevel(result.score);
  return {
    skillName: result.skillName,
    filePath: filePath || null,
    score: result.score,
    maxScore: result.maxScore,
    level: level.level,
    stars: level.stars,
    passed: result.passed,
    checks,
  };
}

/**
 * 渲染单个检查项的文本行
 *
 * @param {Object} check
 * @returns {string}
 */
function renderCheck(check) {
  const icon = check.status === 'pass' ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
  const code = `${C.bold}${check.code.padEnd(12)}${C.reset}`;
  const name = check.name.padEnd(8);
  const head = `  ${icon}  ${code} ${name}`;
  const lines = [head];
  check.messages.forEach((msg) => {
    lines.push(`${C.gray}      └─${C.reset} ${msg}`);
  });
  check.locations
    .filter((loc) => loc && loc.line)
    .forEach((loc) => {
      lines.push(
        `${C.gray}         @ line ${loc.line}${loc.hint ? `  (${loc.hint})` : ''}${C.reset}`,
      );
    });
  return lines.join('\n');
}

/**
 * 渲染单个技能的文本报告
 *
 * @param {Object} result - runAllChecks 返回的结果
 * @param {string} [filePath]
 * @returns {string}
 */
function renderText(result, filePath) {
  const level = resolveLevel(result.score);
  const levelColor =
    level.level === 'Gold'
      ? C.yellow
      : level.level === 'Silver'
        ? C.cyan
        : C.red;
  const statusIcon = result.passed ? `${C.green}通过${C.reset}` : `${C.red}未通过${C.reset}`;

  const lines = [];
  lines.push('');
  lines.push(`${C.bold}${C.magenta}╭──────────────────────────────────────────────╮${C.reset}`);
  lines.push(`${C.bold}${C.magenta}│${C.reset}  ${C.bold}MetaGO 技能认证报告${C.reset}                          ${C.bold}${C.magenta}│${C.reset}`);
  lines.push(`${C.bold}${C.magenta}╰──────────────────────────────────────────────╯${C.reset}`);
  lines.push('');
  lines.push(`  ${C.bold}技能名称${C.reset}  : ${result.skillName}`);
  if (filePath) lines.push(`  ${C.bold}文件路径${C.reset}  : ${filePath}`);
  lines.push(`  ${C.bold}认证结果${C.reset}  : ${statusIcon}`);
  lines.push(`  ${C.bold}认证等级${C.reset}  : ${levelColor}${level.stars} ${level.level}（${level.desc}）${C.reset}`);
  lines.push(`  ${C.bold}认证分数${C.reset}  : ${result.score} / ${result.maxScore}`);
  lines.push('');
  lines.push(`  ${C.bold}检查明细${C.reset}`);
  lines.push(`  ${C.gray}${'─'.repeat(44)}${C.reset}`);
  result.checks.forEach((c) => lines.push(renderCheck(c)));
  lines.push('');
  return lines.join('\n');
}

/**
 * 渲染目录扫描汇总报告
 *
 * @param {Array<{ result: Object, filePath: string }>} entries
 * @returns {string}
 */
function renderSummary(entries) {
  const total = entries.length;
  const passed = entries.filter((e) => e.result.passed).length;
  const failed = total - passed;
  const gold = entries.filter((e) => resolveLevel(e.result.score).level === 'Gold').length;
  const silver = entries.filter((e) => resolveLevel(e.result.score).level === 'Silver').length;

  const lines = [];
  lines.push('');
  lines.push(`${C.bold}${C.magenta}╭──────────────────────────────────────────────╮${C.reset}`);
  lines.push(`${C.bold}${C.magenta}│${C.reset}  ${C.bold}MetaGO 批量认证汇总报告${C.reset}                      ${C.bold}${C.magenta}│${C.reset}`);
  lines.push(`${C.bold}${C.magenta}╰──────────────────────────────────────────────╯${C.reset}`);
  lines.push('');
  lines.push(`  ${C.bold}扫描技能数${C.reset} : ${total}`);
  lines.push(`  ${C.green}通过${C.reset}        : ${passed}  ${C.gray}(Gold ${gold} / Silver ${silver})${C.reset}`);
  lines.push(`  ${C.red}未通过${C.reset}      : ${failed}`);
  lines.push('');

  if (total > 0) {
    lines.push(`  ${C.bold}明细列表${C.reset}`);
    lines.push(`  ${C.gray}${'─'.repeat(44)}${C.reset}`);
    entries.forEach((e) => {
      const level = resolveLevel(e.result.score);
      const icon = e.result.passed
        ? (level.level === 'Gold' ? `${C.yellow}★${C.reset}` : `${C.cyan}☆${C.reset}`)
        : `${C.red}✗${C.reset}`;
      const name = e.result.skillName.padEnd(28);
      const score = `${e.result.score}/${e.result.maxScore}`;
      lines.push(`  ${icon}  ${name} ${score.padStart(5)}  ${level.stars}`);
    });
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * 渲染批量结果的 JSON（数组）
 *
 * @param {Array<{ result: Object, filePath: string }>} entries
 * @returns {Object}
 */
function summaryToJson(entries) {
  return {
    total: entries.length,
    passed: entries.filter((e) => e.result.passed).length,
    failed: entries.filter((e) => !e.result.passed).length,
    gold: entries.filter((e) => resolveLevel(e.result.score).level === 'Gold').length,
    silver: entries.filter((e) => resolveLevel(e.result.score).level === 'Silver').length,
    items: entries.map((e) => resultToJson(e.result, e.filePath)),
  };
}

module.exports = {
  renderText,
  renderSummary,
  resultToJson,
  summaryToJson,
  C,
  colorEnabled,
};
