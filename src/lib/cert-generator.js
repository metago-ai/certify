'use strict';

/**
 * 认证证书生成器
 *
 * 在技能通过认证后，生成 .certified.json 证书文件。
 * 证书采用确定性结构，便于后续验证与版本演进。
 */

const fs = require('fs');
const path = require('path');
const { STANDARD_VERSION, resolveLevel, MAX_SCORE } = require('../standards');

/**
 * 构造证书对象（不写盘，便于测试与预览）
 *
 * @param {Object} params
 * @param {string} params.skillName - 技能名（来自 frontmatter.name）
 * @param {number} params.score - 实际得分
 * @param {Object} params.checkStatus - 各检查项状态映射 { FORMAT: 'pass', ... }
 * @param {Date} [params.certifiedAt] - 认证时间，默认当前
 * @returns {Object} 证书对象
 */
function buildCertificate({ skillName, score, checkStatus, certifiedAt }) {
  const at = certifiedAt instanceof Date ? certifiedAt : new Date();
  const level = resolveLevel(score).level;
  return {
    skillName,
    certifiedAt: at.toISOString(),
    score,
    maxScore: MAX_SCORE,
    level,
    standardVersion: STANDARD_VERSION,
    checks: { ...checkStatus },
  };
}

/**
 * 根据检查结果构造证书
 *
 * @param {string} skillName
 * @param {Array<{code: string, status: string}>} checks
 * @returns {Object} 证书对象
 */
function buildCertificateFromChecks(skillName, checks) {
  const score = checks.filter((c) => c.status === 'pass').length;
  const checkStatus = {};
  checks.forEach((c) => {
    checkStatus[c.code] = c.status;
  });
  return buildCertificate({ skillName, score, checkStatus });
}

/**
 * 计算证书写入路径
 * 约定：与 SKILL.md 同目录，文件名 .certified.json
 *
 * @param {string} skillFilePath - SKILL.md 完整路径
 * @returns {string} 证书路径
 */
function resolveCertPath(skillFilePath) {
  const dir = path.dirname(skillFilePath);
  return path.join(dir, '.certified.json');
}

/**
 * 写入证书文件（自动创建父目录）
 *
 * @param {string} skillFilePath - SKILL.md 完整路径
 * @param {Object} certificate - 证书对象
 * @returns {string} 实际写入路径
 */
function writeCertificate(skillFilePath, certificate) {
  const certPath = resolveCertPath(skillFilePath);
  const dir = path.dirname(certPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // 2 空格缩进，末尾换行，便于版本控制 diff
  fs.writeFileSync(certPath, JSON.stringify(certificate, null, 2) + '\n', 'utf-8');
  return certPath;
}

/**
 * 读取并校验证书文件是否为合法的 MetaGO 证书
 *
 * @param {string} certPath - 证书路径
 * @returns {{ valid: boolean, certificate: Object|null, error?: string }}
 */
function readCertificate(certPath) {
  try {
    const raw = fs.readFileSync(certPath, 'utf-8');
    const obj = JSON.parse(raw);
    const valid =
      obj &&
      typeof obj === 'object' &&
      typeof obj.skillName === 'string' &&
      typeof obj.certifiedAt === 'string' &&
      typeof obj.level === 'string' &&
      typeof obj.standardVersion === 'string' &&
      typeof obj.score === 'number' &&
      typeof obj.maxScore === 'number' &&
      obj.checks &&
      typeof obj.checks === 'object';
    return valid ? { valid: true, certificate: obj } : { valid: false, certificate: null, error: '证书结构不完整' };
  } catch (e) {
    return { valid: false, certificate: null, error: e.message };
  }
}

module.exports = {
  buildCertificate,
  buildCertificateFromChecks,
  resolveCertPath,
  writeCertificate,
  readCertificate,
};
