#!/usr/bin/env node
'use strict';

/**
 * MetaGO Certify CLI 入口
 * 技能认证体系命令行接口 —— 让第三方技能通过认证测试获得 "MetaGO 认证" 标记
 *
 * 该入口仅负责引导启动，所有命令注册与分发逻辑在 src/index.js 中完成。
 * 零运行时依赖，跨平台（Windows/macOS/Linux）。
 */

const { run } = require('../src/index');

run();
