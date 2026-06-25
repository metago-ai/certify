# MetaGO Certify

> 技能认证体系 —— 让第三方技能通过认证测试获得 "MetaGO Certified" 标记

<p align="center">
  <a href="https://www.npmjs.com/package/@metago-ai/certify"><img alt="npm" src="https://img.shields.io/badge/npm-@metago--ai/certify-CB3837?logo=npm"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/License-MIT-green"></a>
  <a href="https://gitee.com/metago/certify"><img alt="Gitee" src="https://img.shields.io/badge/Gitee-certify-C71D23?logo=gitee"></a>
  <img alt="Node" src="https://img.shields.io/badge/Node-%3E%3D14-339933?logo=node.js">
  <img alt="Standard" src="https://img.shields.io/badge/认证标准-1.0.0-blue">
</p>

---

## 这是什么？

**MetaGO Certify** 是 MetaGO 生态的技能质量认证体系。它为 `SKILL.md` 格式的技能提供一套**自动化、可复现、零运行时依赖**的认证检查，通过认证的技能可获得 "MetaGO Certified" 标记与 `.certified.json` 证书。

### 为什么需要它？

随着 MetaGO 生态进入"生态阶段"（Skills Hub 开放市场 + 第三方技能接入），技能来源将从"官方单一来源"转变为"官方 + 第三方多来源"。这带来一个核心信任问题：

> **用户如何知道一个第三方技能是安全、合规、高质量的？**

Certify 通过 6 项机器可验证的检查项回答这个问题：

- 对技能作者：提供客观的质量门槛与改进方向，避免"凭感觉写"
- 对技能使用者：提供可验证的信任标记，降低选择与审查成本
- 对生态平台（Skills Hub）：提供自动化准入机制，规模化过滤低质/危险技能

一句话：**Certify 是 MetaGO 生态的"质量海关"**。

---

## 安装

```bash
npm install -g @metago-ai/certify
```

安装后即可全局使用 `certify` 命令。无需任何运行时依赖，纯 Node.js 标准库实现。

> 也支持不安装直接通过 `node` 调用：
> ```bash
> node bin/certify.js <command> [options]
> ```

---

## 快速开始

```bash
# 1. 检查单个技能
certify check ./skills/metago-critique/SKILL.md

# 2. 批量检查整个技能目录
certify check --dir ./skills

# 3. 对合格技能颁发认证证书
certify certify ./skills/metago-critique/SKILL.md

# 4. 列出已认证技能
certify list
```

---

## 6 项认证标准

每项检查通过得 1 分，满分 6 分。

| # | 代码 | 检查项 | 通过条件 |
|---|------|--------|----------|
| 1 | `FORMAT` | 格式合规 | SKILL.md 含合法 YAML frontmatter（`---` 分隔），且 frontmatter 包含 `name` 与 `description` 字段 |
| 2 | `NAME` | 名称规范 | `name` 以 `metago-` 开头，仅含小写字母/数字/连字符，长度 8-60 字符 |
| 3 | `DESCRIPTION` | 描述质量 | `description` 非空，长度 10-200 字符，不含占位符标记（TODO/FIXME/待补充 等） |
| 4 | `BODY` | 正文质量 | 正文非空，含至少一个 Markdown 标题（`#` 起始行），且不少于 100 字符 |
| 5 | `SECURITY` | 安全检查 | 不含危险代码模式（`eval(`/`exec(`/`system(`/`child_process`）、非白名单外部 URL、硬编码凭证 |
| 6 | `INTEGRITY` | 完整性 | 不含占位符标记、模板残留（`{{`/`}}`/`<your-`）、外部文件相对路径引用 |

### 设计细节

- **代码示例豁免**：`SECURITY` 与 `INTEGRITY` 的模式检测会先剥离 Markdown 代码块（` ``` `）与行内代码（`` ` ` ``），因此技能文档中以"示例"形式展示 `eval()`、`{{variable}}` 等是合法的。这使得"讨论安全/占位符的元技能"（如 `metago-output-integrity`）不会被误判。
- **凭证检测不豁免**：硬编码凭证即使在代码块中也视为泄露，仍会触发告警。
- **URL 白名单**：`gitee.com/metago`、`github.com/metago-ai`、`metago.ai` 等 MetaGO 官方域名下的链接视为标准文档链接，不触发外部 URL 告警。

---

## 认证等级

| 等级 | 分数 | 标记 | 含义 |
|------|------|------|------|
| **Gold** | 6/6 | ⭐⭐⭐⭐⭐ | 完全认证 —— 全部检查项通过 |
| **Silver** | 5/6 | ⭐⭐⭐⭐ | 基本认证 —— 仅 1 项未通过，可颁发证书 |
| **Failed** | ≤4/6 | ❌ | 不通过 —— 不颁发证书，需修复后重新认证 |

> 通过门槛为 **Silver 及以上**（≥5 分）。`certify certify` 命令仅对 Silver 及以上技能生成证书。

---

## CLI 命令参考

### `certify check`（别名 `c`）

检查单个或目录下所有 SKILL.md 是否符合认证标准。

```bash
# 检查单个文件
certify check <skill-path>

# 批量检查目录（递归扫描 SKILL.md）
certify check --dir <skills-dir>

# 输出 JSON 格式报告（便于 CI/CD 集成）
certify check <skill-path> --json

# 批量模式并打印每个技能的详细报告
certify check --dir <skills-dir> --verbose
```

**退出码**：`0` 表示全部通过，`1` 表示存在未通过项或参数错误。

### `certify certify`

对技能进行正式认证。通过检查（Silver 及以上）后，在 SKILL.md 同目录生成 `.certified.json` 证书。

```bash
certify certify <skill-path>
certify certify <skill-path> --json
```

未通过时返回退出码 `1`，并列出未通过的检查项，便于定位修复。

### `certify list`

列出当前目录（或指定目录）下所有已认证技能（递归扫描 `.certified.json`）。

```bash
certify list              # 扫描当前目录
certify list <dir>        # 扫描指定目录
certify list --json       # JSON 输出
```

### `certify version`

显示版本号与认证标准版本号。

```bash
certify version
certify --version
certify -V
```

### `certify help`

显示帮助。

```bash
certify help              # 主帮助
certify help check        # check 子命令帮助
certify help              # 等价于 certify --help
```

---

## 证书格式

认证通过后生成的 `.certified.json`：

```json
{
  "skillName": "metago-critique",
  "certifiedAt": "2026-06-26T12:00:00.000Z",
  "score": 6,
  "maxScore": 6,
  "level": "Gold",
  "standardVersion": "1.0.0",
  "checks": {
    "FORMAT": "pass",
    "NAME": "pass",
    "DESCRIPTION": "pass",
    "BODY": "pass",
    "SECURITY": "pass",
    "INTEGRITY": "pass"
  }
}
```

| 字段 | 说明 |
|------|------|
| `skillName` | 技能名（取自 frontmatter.name） |
| `certifiedAt` | 认证时间（ISO 8601） |
| `score` / `maxScore` | 得分 / 满分（6） |
| `level` | 认证等级（Gold / Silver） |
| `standardVersion` | 认证标准版本号（当前 1.0.0） |
| `checks` | 各检查项结果映射 |

---

## 项目结构

```
metago-certify/
├── package.json
├── README.md
├── LICENSE                # MIT
├── bin/
│   └── certify.js         # CLI 入口（带 shebang）
└── src/
    ├── index.js           # 主命令分发（零依赖）
    ├── standards.js       # 认证标准与常量定义
    ├── commands/
    │   ├── check.js       # check 命令（单文件 / 批量目录）
    │   ├── certify.js     # certify 命令（颁发证书）
    │   ├── list.js        # list 命令（列出已认证）
    │   └── version.js     # version 命令
    └── lib/
        ├── parser.js      # SKILL.md 解析器（自实现 YAML frontmatter）
        ├── checker.js     # 6 项检查逻辑
        ├── cert-generator.js  # 证书生成与读写
        └── reporter.js    # 报告渲染（文本/JSON，支持彩色终端）
```

### 设计约束

1. **零运行时依赖** —— 不依赖 commander、yaml 等任何第三方库，全部用 Node.js 标准库实现
2. **自实现 frontmatter 解析** —— 不引入外部 YAML 库
3. **独立实现** —— 不依赖 `@metago-ai/skills-sdk`，避免循环依赖
4. **跨平台** —— 兼容 Windows / macOS / Linux，容忍 CRLF/LF 与 UTF-8 BOM
5. **CommonJS 格式** —— 兼容 Node.js 14+
6. **无硬编码凭证** —— 本包自身也通过自身的认证标准

---

## 与产品矩阵的关系

MetaGO Certify 属于产品矩阵 **D 线（生态基础设施）**，是"生态阶段"闭环的关键一环。

依据《MetaGO 产品矩阵战略规划》，MetaGO 演进分三阶段：

| 阶段 | 形态 | 时间 | 状态 |
|------|------|------|------|
| Kit 阶段 | 单一 npm 包 `metago-lifeform` | 已完成 | ✅ |
| 产品矩阵阶段 | 多产品线独立演进 | 2026 Q3 | 🚧 |
| **生态阶段** | Skills Hub 开放市场 + 第三方技能接入 + **认证体系** | 2027 Q1+ | 📋 |

### 完整产品矩阵（4 线 × 12 产品）

| 线 | 产品 | 形态 | 定位 | 状态 |
|----|------|------|------|------|
| **A 垂直场景包** | MetaGO Dev Kit | npm 包 | 开发场景能力增强 | 🚧 |
| | MetaGO Research Kit | npm 包 | 学术研究能力增强 | 📋 |
| | MetaGO PM Kit | npm 包 | 产品工作能力增强 | 📋 |
| | MetaGO Writer Kit | npm 包 | 写作场景能力增强 | 📋 |
| **B 平台工具** | MetaGO MCP Server | MCP 协议包 | 22 项能力封装为 MCP 工具 | ✅ |
| | MetaGO CLI | 命令行工具 | 跨平台 CLI 调用元构能力 | 📋 |
| | MetaGO Studio | 桌面/Web 应用 | 可视化技能编排与调试 | 📋 |
| **C 终端用户产品** | MetaGO Copilot | 桌面助手 | 内置元构能力的桌面 AI 助手 | 📋 |
| | MetaGO Chat | Web 对话产品 | 基于元构生命体的对话产品 | 📋 |
| | MetaGO Agent Cloud | 云端智能体 | 托管式元构智能体云服务 | 📋 |
| **D 生态基础设施** | MetaGO Skills SDK | npm/Python 包 | 技能开发框架（第三方编写 SKILL.md） | 📋 |
| | MetaGO Skills Hub | Web 平台 | 技能市场（发布/订阅/发现/评分） | 📋 |
| | **MetaGO Certify** | **认证服务** | **技能质量认证体系（本项目）** | **🚧** |

### 在生态中的位置

```
第三方技能作者 ──编写──▶ Skills SDK ──发布──▶ Skills Hub ──准入检查──▶ Certify ──颁发证书──▶ 用户可信赖选择
                                                              │
                                                              └── 返回 "MetaGO Certified" 标记
```

Certify 是 Skills Hub 的**准入闸门**：所有上架技能必须通过 Certify 的 Silver 及以上认证，方可获得 "MetaGO Certified" 标记，进入推荐排序。这构成生态的"质量-信任"飞轮。

---

## 战略规划

本产品的设计与演进遵循 MetaGO 最高战略纲领：

- **战略文档**：[MetaGO 产品矩阵战略规划](https://gitee.com/metago/metagolifeform/blob/main/docs/STRATEGY.md)
- **产品需求文档**：[MetaGO PRD](https://gitee.com/metago/metagolifeform/blob/main/docs/PRD.md)
- **架构文档**：[MetaGO Architecture](https://gitee.com/metago/metagolifeform/blob/main/docs/ARCHITECTURE.md)
- **生态主页**：https://gitee.com/metago/metagolifeform

Certify 对应战略规划中 **D 线 · 第 4 阶段（生态阶段）** 的"认证服务"产品位。

---

## 许可证

[MIT](./LICENSE) © MetaGO Lightyear
