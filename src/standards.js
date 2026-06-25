'use strict';

/**
 * MetaGO Certify 认证标准定义
 *
 * 定义 6 项认证检查项、评分规则、认证等级，以及安全白名单等常量。
 * 集中管理以便未来标准版本演进时统一调整。
 */

/**
 * 认证标准版本号
 * 当检查项或评分规则发生不兼容变更时递增
 */
const STANDARD_VERSION = '1.0.0';

/**
 * 全部检查项定义（顺序即展示顺序）
 * @typedef {Object} CheckItem
 * @property {string} code - 检查项代码（大写常量）
 * @property {string} name - 检查项中文名
 * @property {string} desc - 检查项说明
 */
const CHECK_ITEMS = [
  {
    code: 'FORMAT',
    name: '格式合规',
    desc: 'SKILL.md 必须包含合法的 YAML frontmatter，且 frontmatter 必须包含 name 与 description 字段',
  },
  {
    code: 'NAME',
    name: '名称规范',
    desc: 'name 必须以 metago- 开头，仅含小写字母/数字/连字符，长度 8-60 字符',
  },
  {
    code: 'DESCRIPTION',
    name: '描述质量',
    desc: 'description 不能为空，长度 10-200 字符，且不得包含占位符',
  },
  {
    code: 'BODY',
    name: '正文质量',
    desc: '正文不能为空，须含至少一个 Markdown 标题，且不少于 100 字符',
  },
  {
    code: 'SECURITY',
    name: '安全检查',
    desc: '不含危险代码模式、非白名单外部 URL、硬编码凭证',
  },
  {
    code: 'INTEGRITY',
    name: '完整性',
    desc: '不含占位符、模板残留，且正文自包含不依赖外部文件',
  },
];

/** 各检查项代码常量集合（便于引用） */
const CHECK_CODES = CHECK_ITEMS.reduce((acc, item) => {
  acc[item.code] = item.code;
  return acc;
}, {});

/**
 * 认证等级判定规则
 * @typedef {Object} LevelRule
 * @property {number} minScore - 达到该等级所需的最低分数
 * @property {string} level - 等级名（Gold/Silver/Failed）
 * @property {string} stars - 星级展示
 * @property {string} desc - 等级说明
 */
const LEVEL_RULES = [
  { minScore: 6, level: 'Gold', stars: '⭐⭐⭐⭐⭐', desc: '完全认证' },
  { minScore: 5, level: 'Silver', stars: '⭐⭐⭐⭐', desc: '基本认证' },
  { minScore: 0, level: 'Failed', stars: '❌', desc: '不通过' },
];

/** 最高分（检查项总数） */
const MAX_SCORE = CHECK_ITEMS.length;

/**
 * 根据得分判定认证等级
 * @param {number} score - 实际得分
 * @returns {LevelRule} 等级规则
 */
function resolveLevel(score) {
  for (const rule of LEVEL_RULES) {
    if (score >= rule.minScore) return rule;
  }
  return LEVEL_RULES[LEVEL_RULES.length - 1];
}

/**
 * 安全检查白名单 URL 域名片段
 * 仅这些域名下的 URL 视为"标准文档链接"，不触发外部 URL 告警
 */
const URL_WHITELIST = [
  'gitee.com/metago',
  'github.com/metago-ai',
  'github.com/metago',
  'metago.ai',
  'raw.githubusercontent.com/metago-ai',
  'raw.githubusercontent.com/metago',
  'npmjs.com/package/@metago-ai',
  'registry.npmjs.org/@metago-ai',
];

/**
 * 危险代码模式（正则字符串，构造 RegExp 时转义）
 * 命中任意一项即判定 SECURITY 失败
 *
 * 设计说明：
 *   - 仅保留规格约定的 eval/exec/system/child_process
 *   - 加 \b 单词边界，避免误伤 medieval/execute 等正常词汇
 *   - 检测时剥离 Markdown 代码块/行内代码，使代码示例豁免
 *     （技能文档中以示例形式展示危险模式是合理的）
 */
const DANGEROUS_PATTERNS = [
  '\\beval\\s*\\(',
  '\\bexec\\s*\\(',
  '\\bsystem\\s*\\(',
  'child_process',
];

/**
 * 硬编码凭证模式
 * 命中任意一项即判定 SECURITY 失败
 */
const CREDENTIAL_PATTERNS = [
  '(?:api[_-]?key|apikey)\\s*[:=]\\s*["\']?[A-Za-z0-9]{16,}',
  '(?:password|passwd|pwd)\\s*[:=]\\s*["\']?\\S{6,}',
  '(?:secret|token)\\s*[:=]\\s*["\']?[A-Za-z0-9]{16,}',
  'AKIA[0-9A-Z]{16}',
  '-----BEGIN (?:RSA |EC |DSA |OPENSSH |)PRIVATE KEY-----',
];

/**
 * 占位符标记模式（大小写不敏感）
 * 命中任意一项即判定对应检查项失败
 *
 * 设计说明：
 *   - TODO/FIXME/XXX 加 \b 单词边界，避免误伤 TODOLIST 等复合词
 *   - 不将"占位符"列为模式：它是正常中文技术词汇，
 *     在描述"占位符检测能力"的元技能中出现是合理的
 *   - 检测时剥离 Markdown 代码块/行内代码，使示例豁免
 */
const PLACEHOLDER_PATTERNS = [
  '\\bTODO\\b',
  '\\bFIXME\\b',
  '\\bXXX\\b',
  '待补充',
  '待完善',
  '待填写',
];

/**
 * 模板残留模式
 * 命中任意一项即判定 INTEGRITY 失败
 */
const TEMPLATE_RESIDUE_PATTERNS = [
  '\\{\\{',
  '\\}\\}',
  '<your-',
  '<your_',
  '<my-',
  '<skill-name>',
  '<description>',
  '\\$\\{.+?\\}',
];

module.exports = {
  STANDARD_VERSION,
  CHECK_ITEMS,
  CHECK_CODES,
  LEVEL_RULES,
  MAX_SCORE,
  URL_WHITELIST,
  DANGEROUS_PATTERNS,
  CREDENTIAL_PATTERNS,
  PLACEHOLDER_PATTERNS,
  TEMPLATE_RESIDUE_PATTERNS,
  resolveLevel,
};
