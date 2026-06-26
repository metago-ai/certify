'use strict';

/**
 * MetaGO Certify 主入口
 *
 * 轻量级命令分发器，零运行时依赖。
 * 支持子命令：check（别名 c）、certify、list、version、help
 * 支持全局 flag：--version / -V / --help / -h
 */

const pkg = require('../package.json');
const { STANDARD_VERSION } = require('./standards');
const { C } = require('./lib/reporter');

const check = require('./commands/check');
const certify = require('./commands/certify');
const list = require('./commands/list');
const version = require('./commands/version');

/** 命令表（名称 -> 处理器） */
const COMMANDS = {
  check,
  c: check, // 别名
  certify,
  list,
  version,
};

/** 全局版本 flag */
const VERSION_FLAGS = new Set(['--version', '-V', '-v']);

/** 全局帮助 flag */
const HELP_FLAGS = new Set(['--help', '-h', 'help']);

/**
 * 主帮助文本
 */
function mainHelp() {
  const lines = [
    '',
    `${C.bold}${C.magenta}@metago-ai/certify${C.reset} v${pkg.version}  ${C.gray}（标准 ${STANDARD_VERSION}）${C.reset}`,
    '',
    `${C.bold}技能认证体系${C.reset} —— 让第三方技能通过认证测试获得 "MetaGO Certified" 标记`,
    '',
    `${C.bold}用法${C.reset}:`,
    `  certify <command> [options] [args]`,
    '',
    `${C.bold}命令${C.reset}:`,
    `  ${C.cyan}check${C.reset}  (别名 c)   检查单个或目录下所有 SKILL.md 是否符合认证标准`,
    `  ${C.cyan}certify${C.reset}           对技能进行正式认证（通过则颁发 .certified.json 证书）`,
    `  ${C.cyan}list${C.reset}              列出已认证技能（扫描 .certified.json）`,
    `  ${C.cyan}version${C.reset}           显示版本号`,
    `  ${C.cyan}help${C.reset}  [command]   显示帮助（可指定子命令）`,
    '',
    `${C.bold}选项${C.reset}:`,
    `  --json              以 JSON 格式输出（适用于 check / certify / list）`,
    `  --dir <path>        批量检查目录（check 专用）`,
    `  --verbose, -v       显示详细信息`,
    `  --version, -V       显示版本号`,
    `  --help, -h          显示帮助`,
    '',
    `${C.bold}示例${C.reset}:`,
    `  ${C.gray}# 检查单个技能${C.reset}`,
    `  certify check ./skills/metago-critique/SKILL.md`,
    `  certify c ./skills/metago-critique/SKILL.md --json`,
    '',
    `  ${C.gray}# 批量检查目录${C.reset}`,
    `  certify check --dir ./skills`,
    '',
    `  ${C.gray}# 正式认证（生成证书）${C.reset}`,
    `  certify certify ./skills/metago-critique/SKILL.md`,
    '',
    `  ${C.gray}# 列出已认证技能${C.reset}`,
    `  certify list`,
    '',
    `${C.bold}认证等级${C.reset}:`,
    `  ${C.yellow}Gold${C.reset}    6/6  ${C.yellow}⭐⭐⭐⭐⭐${C.reset}  完全认证`,
    `  ${C.cyan}Silver${C.reset}  5/6  ${C.cyan}⭐⭐⭐⭐${C.reset}    基本认证`,
    `  ${C.red}Failed${C.reset}  ≤4   ${C.red}❌${C.reset}          不通过`,
    '',
    `${C.gray}文档: https://gitee.com/metago/certify${C.reset}`,
    `${C.gray}协议: MIT${C.reset}`,
    '',
  ];
  return lines.join('\n');
}

/**
 * 显示指定子命令的帮助
 * @param {string} name
 * @returns {number}
 */
function showSubHelp(name) {
  const cmd = COMMANDS[name];
  if (cmd && cmd.HELP) {
    console.log(cmd.HELP);
    return 0;
  }
  console.error(`未知命令: ${name}`);
  return 1;
}

/**
 * 启动 CLI：解析参数并分发到对应命令。
 * @returns {void}
 */
function run() {
  const argv = process.argv.slice(2);

  // 无参数：显示主帮助
  if (argv.length === 0) {
    console.log(mainHelp());
    process.exit(0);
    return;
  }

  const first = argv[0];

  // 全局 flag
  if (VERSION_FLAGS.has(first)) {
    process.exit(version.run([]));
    return;
  }
  if (HELP_FLAGS.has(first)) {
    const sub = argv[1];
    if (sub && !sub.startsWith('-') && COMMANDS[sub]) {
      process.exit(showSubHelp(sub));
      return;
    }
    console.log(mainHelp());
    process.exit(0);
    return;
  }

  // 子命令分发
  const rest = argv.slice(1);
  const handler = COMMANDS[first];
  if (!handler) {
    console.error(`${C.red}未知命令${C.reset}: ${first}`);
    console.error(`输入 ${C.cyan}certify help${C.reset} 查看可用命令。`);
    process.exit(1);
    return;
  }

  // 子命令自身的 --help
  if (rest[0] === '--help' || rest[0] === '-h') {
    if (handler.HELP) {
      console.log(handler.HELP);
      process.exit(0);
      return;
    }
  }

  try {
    const code = handler.run(rest);
    process.exit(typeof code === 'number' ? code : 0);
  } catch (err) {
    console.error(`${C.red}错误${C.reset}: ${err && err.message ? err.message : String(err)}`);
    if (process.env.DEBUG) {
      console.error(err && err.stack ? err.stack : '');
    }
    process.exit(1);
  }
}

module.exports = { run, mainHelp, showSubHelp, COMMANDS };
