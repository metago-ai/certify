'use strict';

/**
 * SKILL.md 解析器
 *
 * 自实现 YAML frontmatter 解析，不依赖任何外部 YAML 库。
 * 支持特性：
 *   - frontmatter 边界识别（--- ... ---）
 *   - 简单 key: value 标量
 *   - 块式数组（- item）
 *   - 内联数组（[a, b, c]）
 *   - 字符串/数字/布尔/null 标量
 *   - BOM 头容忍、CRLF/LF 换行容忍
 *
 * 设计目标：覆盖 SKILL.md 实际使用的全部语法，足够稳健但不追求完整 YAML 规范。
 */

/** frontmatter 分隔符 */
const FRONTMATTER_DELIMITER = '---';

/**
 * 解析 SKILL.md 内容
 * 格式：---\n<yaml>\n---\n<markdown body>
 *
 * @param {string} content 文件内容
 * @returns {{ frontmatter: Record<string, unknown>, body: string, raw: string }} 解析结果
 */
function parseSkillMarkdown(content) {
  // 原始内容保留，便于后续行号定位
  const raw = content;

  // 容忍 UTF-8 BOM 头
  const normalized = content.replace(/^\uFEFF/, '');
  const trimmed = normalized.trimStart();

  // 不以 --- 开头则视为无 frontmatter
  if (!trimmed.startsWith(FRONTMATTER_DELIMITER)) {
    return { frontmatter: {}, body: normalized, raw };
  }

  // 跳过起始 ---，确认其后是行尾或空白（避免误判 ---abc）
  const afterFirst = trimmed.slice(FRONTMATTER_DELIMITER.length);
  if (afterFirst.length > 0 && afterFirst[0] !== '\n' && afterFirst[0] !== '\r') {
    // 起始 --- 后非行尾，整体作为 body
    return { frontmatter: {}, body: normalized, raw };
  }

  // 查找结束 ---（必须独占一行）
  const endMarker = '\n' + FRONTMATTER_DELIMITER;
  const endIdx = afterFirst.indexOf(endMarker);
  if (endIdx === -1) {
    // 未闭合，整体作为 body
    return { frontmatter: {}, body: normalized, raw };
  }

  const yamlContent = afterFirst.slice(0, endIdx);
  // 跳过结束 --- 及其所在行
  const afterEnd = afterFirst.slice(endIdx + endMarker.length);
  // 去除 body 前导换行
  const body = afterEnd.replace(/^[\r\n]+/, '');

  return { frontmatter: parseSimpleYaml(yamlContent), body, raw };
}

/**
 * 解析简单 YAML（仅支持 key: value 与数组，足够覆盖 SKILL.md 场景）
 *
 * @param {string} yamlContent YAML 字符串
 * @returns {Record<string, unknown>} 解析后的对象
 */
function parseSimpleYaml(yamlContent) {
  const result = {};
  const lines = yamlContent.split(/\r?\n/);

  let currentKey = '';
  let inArray = false;
  const arrayBuffer = [];

  // 刷新当前累积的数组到结果
  const flush = () => {
    if (inArray && currentKey) {
      result[currentKey] = arrayBuffer.slice();
      arrayBuffer.length = 0;
      inArray = false;
      currentKey = '';
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    // 跳过空行与注释
    if (!line || line.startsWith('#')) continue;

    // 块式数组项：- value
    if (line.startsWith('- ')) {
      if (inArray) {
        arrayBuffer.push(parseScalar(line.slice(2).trim()));
      }
      continue;
    }
    // 仅 - 也视为数组空项占位，忽略
    if (line === '-') continue;

    // key: value
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    // 进入新的 key 前，先刷新之前的数组
    flush();

    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();

    if (value === '') {
      // 值为空：可能为数组开始
      currentKey = key;
      inArray = true;
      arrayBuffer.length = 0;
    } else {
      result[key] = parseScalar(value);
    }
  }

  flush();
  return result;
}

/**
 * 解析标量值
 * 支持：内联数组、引号字符串、布尔、null、整数、浮点数、裸字符串
 *
 * @param {string} raw 原始字符串
 * @returns {unknown} 解析后的值
 */
function parseScalar(raw) {
  // 内联数组 [a, b, c]
  if (raw.startsWith('[') && raw.endsWith(']')) {
    const inner = raw.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((s) => parseScalar(s.trim()));
  }
  // 引号字符串
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  // 布尔
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  // null
  if (raw === 'null' || raw === '~') return null;
  // 整数
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  // 浮点数
  if (/^-?\d+\.\d+$/.test(raw)) return parseFloat(raw);
  // 裸字符串
  return raw;
}

/**
 * 定位某段文本在原始内容中的行号（1-based）
 * 用于在报告中给出精准的错误定位
 *
 * @param {string} content 原始内容
 * @param {string} snippet 待定位片段
 * @returns {number|null} 行号，未找到返回 null
 */
function locateLineNumber(content, snippet) {
  if (!snippet) return null;
  const idx = content.indexOf(snippet);
  if (idx === -1) return null;
  return content.slice(0, idx).split(/\r?\n/).length;
}

module.exports = {
  parseSkillMarkdown,
  parseSimpleYaml,
  locateLineNumber,
  FRONTMATTER_DELIMITER,
};
