'use strict';

/**
 * 认证检查器
 *
 * 实现 6 项认证检查逻辑，返回结构化的检查结果。
 * 每项检查独立可测，便于单元测试与未来扩展。
 */

const {
  CHECK_ITEMS,
  URL_WHITELIST,
  DANGEROUS_PATTERNS,
  CREDENTIAL_PATTERNS,
  PLACEHOLDER_PATTERNS,
  TEMPLATE_RESIDUE_PATTERNS,
} = require('../standards');
const { parseSkillMarkdown, locateLineNumber } = require('./parser');

/**
 * @typedef {Object} CheckResult
 * @property {string} code - 检查项代码
 * @property {string} name - 检查项名称
 * @property {'pass'|'fail'} status - 检查结果
 * @property {string[]} messages - 详细信息（失败原因或通过说明）
 * @property {Array<{line: number|null, hint: string}>} locations - 问题定位
 */

/**
 * 将正则字符串数组编译为单个正则（大小写不敏感，全局）
 * @param {string[]} patterns
 * @returns {RegExp}
 */
function buildRegex(patterns) {
  return new RegExp(patterns.join('|'), 'gi');
}

/**
 * 在文本中查找所有命中项，返回命中的原文与行号
 * @param {string} text
 * @param {RegExp} regex
 * @param {string} raw
 * @returns {Array<{match: string, line: number|null}>}
 */
function findMatches(text, regex, raw) {
  const results = [];
  // 重置 lastIndex（因为正则带 g 标志且可能被复用）
  regex.lastIndex = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const matched = m[0];
    results.push({ match: matched, line: locateLineNumber(raw, matched) });
    // 防止零宽匹配导致死循环
    if (m.index === regex.lastIndex) regex.lastIndex++;
  }
  return results;
}

/**
 * 剥离 Markdown 代码块与行内代码，返回纯文本
 *
 * 设计动机：技能文档常以"示例"形式展示危险模式或占位符
 * （如 metago-output-integrity 在代码块里展示 {{variable}}）。
 * 代码块中的内容是说明性的，不应触发 SECURITY / INTEGRITY 告警。
 * 凭证检测仍使用原始内容（代码块里的凭证同样危险）。
 *
 * @param {string} content
 * @returns {string}
 */
function stripMarkdownCode(content) {
  // 先剥离围栏代码块 ``` ... ```（含语言标识）
  let s = content.replace(/```[\w-]*[\s\S]*?```/g, '');
  // 再剥离行内代码 ` ... `（不跨行，不含反引号）
  s = s.replace(/`[^`\n]*`/g, '');
  return s;
}

/**
 * 检查 1：格式合规 (FORMAT)
 * - 必须有 YAML frontmatter（--- 分隔）
 * - frontmatter 必须包含 name 与 description 字段
 *
 * @param {ReturnType<parseSkillMarkdown>} parsed
 * @returns {CheckResult}
 */
function checkFormat(parsed) {
  const messages = [];
  const locations = [];
  const hasFrontmatter =
    parsed.raw.replace(/^\uFEFF/, '').trimStart().startsWith('---') &&
    Object.keys(parsed.frontmatter).length > 0;

  if (!hasFrontmatter) {
    messages.push('缺少合法的 YAML frontmatter（应以 --- 起始与闭合）');
    locations.push({ line: 1, hint: '文件起始处' });
  }
  if (parsed.frontmatter.name === undefined) {
    messages.push('frontmatter 缺少 name 字段');
  }
  if (parsed.frontmatter.description === undefined) {
    messages.push('frontmatter 缺少 description 字段');
  }

  const status = messages.length === 0 ? 'pass' : 'fail';
  if (status === 'pass') messages.push('frontmatter 合法且包含 name/description');
  return {
    code: 'FORMAT',
    name: '格式合规',
    status,
    messages,
    locations,
  };
}

/**
 * 检查 2：名称规范 (NAME)
 * - 必须以 metago- 开头
 * - 仅含小写字母、数字、连字符
 * - 长度 8-60 字符
 *
 * @param {ReturnType<parseSkillMarkdown>} parsed
 * @returns {CheckResult}
 */
function checkName(parsed) {
  const messages = [];
  const locations = [];
  const name = String(parsed.frontmatter.name ?? '');

  if (!name) {
    messages.push('name 字段为空，无法校验名称规范');
  } else {
    if (!name.startsWith('metago-')) {
      messages.push(`name 必须以 "metago-" 开头，当前为 "${name}"`);
      locations.push({ line: locateLineNumber(parsed.raw, name), hint: name });
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
      messages.push(`name 仅允许小写字母、数字、连字符，当前为 "${name}"`);
    }
    if (name.length < 8 || name.length > 60) {
      messages.push(`name 长度须在 8-60 字符之间，当前为 ${name.length} 字符`);
    }
  }

  const status = messages.length === 0 ? 'pass' : 'fail';
  if (status === 'pass') messages.push(`名称规范合规：${name}`);
  return { code: 'NAME', name: '名称规范', status, messages, locations };
}

/**
 * 检查 3：描述质量 (DESCRIPTION)
 * - 不能为空
 * - 长度 10-200 字符
 * - 不含占位符
 *
 * @param {ReturnType<parseSkillMarkdown>} parsed
 * @returns {CheckResult}
 */
function checkDescription(parsed) {
  const messages = [];
  const locations = [];
  const desc = String(parsed.frontmatter.description ?? '');

  if (!desc) {
    messages.push('description 字段为空');
  } else {
    if (desc.length < 10 || desc.length > 200) {
      messages.push(`description 长度须在 10-200 字符之间，当前为 ${desc.length} 字符`);
    }
    const phRegex = buildRegex(PLACEHOLDER_PATTERNS);
    const phMatches = findMatches(desc, phRegex, parsed.raw);
    if (phMatches.length > 0) {
      messages.push(
        `description 含占位符：${phMatches.map((m) => m.match).join(', ')}`,
      );
      phMatches.forEach((m) => locations.push({ line: m.line, hint: m.match }));
    }
  }

  const status = messages.length === 0 ? 'pass' : 'fail';
  if (status === 'pass') messages.push(`描述质量达标（${desc.length} 字符）`);
  return {
    code: 'DESCRIPTION',
    name: '描述质量',
    status,
    messages,
    locations,
  };
}

/**
 * 检查 4：正文质量 (BODY)
 * - body 不能为空
 * - 含至少一个 Markdown 标题（# 起始行）
 * - 至少 100 字符
 *
 * @param {ReturnType<parseSkillMarkdown>} parsed
 * @returns {CheckResult}
 */
function checkBody(parsed) {
  const messages = [];
  const locations = [];
  const body = parsed.body || '';

  if (!body.trim()) {
    messages.push('正文为空');
  } else {
    if (body.trim().length < 100) {
      messages.push(`正文长度不足 100 字符，当前为 ${body.trim().length} 字符`);
    }
    const hasHeading = /^#{1,6}\s+\S/m.test(body);
    if (!hasHeading) {
      messages.push('正文缺少 Markdown 标题（# 起始行）');
    }
  }

  const status = messages.length === 0 ? 'pass' : 'fail';
  if (status === 'pass') messages.push('正文质量达标');
  return { code: 'BODY', name: '正文质量', status, messages, locations };
}

/**
 * 检查 5：安全检查 (SECURITY)
 * - 不含危险代码模式
 * - 不含非白名单外部 URL
 * - 不含硬编码凭证
 *
 * @param {ReturnType<parseSkillMarkdown>} parsed
 * @returns {CheckResult}
 */
function checkSecurity(parsed) {
  const messages = [];
  const locations = [];
  const content = parsed.raw;
  // 危险代码模式检测使用剥离代码块后的内容（代码示例豁免）
  const stripped = stripMarkdownCode(content);

  // 危险代码模式（eval/exec/system/child_process 等）
  const dangerousRegex = buildRegex(DANGEROUS_PATTERNS);
  const dangerousMatches = findMatches(stripped, dangerousRegex, parsed.raw);
  if (dangerousMatches.length > 0) {
    messages.push(
      `检测到危险代码模式：${[...new Set(dangerousMatches.map((m) => m.match))].join(', ')}`,
    );
    dangerousMatches.forEach((m) =>
      locations.push({ line: m.line, hint: m.match }),
    );
  }

  // 硬编码凭证（代码块里的凭证同样危险，使用原始内容）
  const credRegex = buildRegex(CREDENTIAL_PATTERNS);
  const credMatches = findMatches(content, credRegex, parsed.raw);
  if (credMatches.length > 0) {
    messages.push(
      `检测到疑似硬编码凭证：${credMatches.map((m) => m.match).join(', ')}`,
    );
    credMatches.forEach((m) => locations.push({ line: m.line, hint: m.match }));
  }

  // 外部 URL（非白名单，使用原始内容）
  const urlRegex = /https?:\/\/[^\s"'<>)\]]+/gi;
  const urlMatches = findMatches(content, urlRegex, parsed.raw);
  const externalUrls = [];
  for (const u of urlMatches) {
    const lower = u.match.toLowerCase();
    const isWhitelisted = URL_WHITELIST.some((w) => lower.includes(w));
    if (!isWhitelisted) {
      externalUrls.push(u);
      locations.push({ line: u.line, hint: u.match });
    }
  }
  if (externalUrls.length > 0) {
    messages.push(
      `检测到非白名单外部 URL：${externalUrls.map((u) => u.match).join(', ')}`,
    );
  }

  const status = messages.length === 0 ? 'pass' : 'fail';
  if (status === 'pass') messages.push('安全检查通过，无危险模式');
  return {
    code: 'SECURITY',
    name: '安全检查',
    status,
    messages,
    locations,
  };
}

/**
 * 检查 6：完整性 (INTEGRITY)
 * - 不含占位符
 * - 不含模板残留
 * - 正文自包含（不依赖外部文件）
 *
 * @param {ReturnType<parseSkillMarkdown>} parsed
 * @returns {CheckResult}
 */
function checkIntegrity(parsed) {
  const messages = [];
  const locations = [];
  // 占位符/模板残留/外部引用检测均使用剥离代码块后的内容
  // （技能文档常在代码块中展示这些模式的"示例"）
  const stripped = stripMarkdownCode(parsed.raw);

  // 占位符
  const phRegex = buildRegex(PLACEHOLDER_PATTERNS);
  const phMatches = findMatches(stripped, phRegex, parsed.raw);
  if (phMatches.length > 0) {
    messages.push(
      `检测到占位符标记：${[...new Set(phMatches.map((m) => m.match))].join(', ')}`,
    );
    phMatches.forEach((m) => locations.push({ line: m.line, hint: m.match }));
  }

  // 模板残留
  const tplRegex = buildRegex(TEMPLATE_RESIDUE_PATTERNS);
  const tplMatches = findMatches(stripped, tplRegex, parsed.raw);
  if (tplMatches.length > 0) {
    messages.push(
      `检测到模板残留：${[...new Set(tplMatches.map((m) => m.match))].join(', ')}`,
    );
    tplMatches.forEach((m) => locations.push({ line: m.line, hint: m.match }));
  }

  // 正文自包含：检测相对路径文件引用（./xxx 或 ../xxx 后跟文件名/扩展名）
  const strippedBody = stripMarkdownCode(parsed.body || '');
  const relRefRegex = /(?:\.\.?\/)+[A-Za-z0-9_\-./]+\.(?:md|txt|json|js|ts|py|yaml|yml|sh)/g;
  const relMatches = findMatches(strippedBody, relRefRegex, parsed.raw);
  if (relMatches.length > 0) {
    messages.push(
      `正文引用了外部文件，疑似不自包含：${relMatches.map((m) => m.match).join(', ')}`,
    );
    relMatches.forEach((m) => locations.push({ line: m.line, hint: m.match }));
  }

  const status = messages.length === 0 ? 'pass' : 'fail';
  if (status === 'pass') messages.push('完整性检查通过，无占位符/模板残留/外部依赖');
  return {
    code: 'INTEGRITY',
    name: '完整性',
    status,
    messages,
    locations,
  };
}

/** 检查函数表（与 CHECK_ITEMS 顺序一致） */
const CHECK_FUNCTIONS = [
  checkFormat,
  checkName,
  checkDescription,
  checkBody,
  checkSecurity,
  checkIntegrity,
];

/**
 * 对解析后的 SKILL.md 执行全部 6 项检查
 * @param {string} content 文件内容
 * @returns {{ skillName: string, checks: CheckResult[], score: number, maxScore: number, passed: boolean }}
 */
function runAllChecks(content) {
  const parsed = parseSkillMarkdown(content);
  const checks = CHECK_FUNCTIONS.map((fn) => fn(parsed));

  const score = checks.filter((c) => c.status === 'pass').length;
  const skillName = String(parsed.frontmatter.name ?? '(未命名技能)');

  return {
    skillName,
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    checks,
    score,
    maxScore: CHECK_ITEMS.length,
    passed: score >= 5, // 5 分及以上视为通过认证（Silver 起步）
  };
}

module.exports = {
  runAllChecks,
  checkFormat,
  checkName,
  checkDescription,
  checkBody,
  checkSecurity,
  checkIntegrity,
};
