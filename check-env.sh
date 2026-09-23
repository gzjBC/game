#!/bin/bash
# 《High》环境检查脚本（macOS 版）
# 每次开发前运行：bash check-env.sh
PASS=0; FAIL=0
check() {
  if [ "$2" = "ok" ]; then PASS=$((PASS+1)); echo "[PASS] $1 - $3"
  else FAIL=$((FAIL+1)); echo "[FAIL] $1 - $3"; fi
}
echo "===== 《High》环境检查（macOS）====="

# 1) Node.js
NODE_VER=$(node -v 2>/dev/null)
if [[ "$NODE_VER" =~ ^v([0-9]+) ]]; then
  if [ "${BASH_REMATCH[1]}" -ge 20 ]; then check "Node.js" ok "$NODE_VER (>=20 OK)"; else check "Node.js" fail "$NODE_VER 版本 <20，请升级到 20 LTS"; fi
else check "Node.js" fail "未检测到，请安装 https://nodejs.org/"; fi

# 2) npm
NPM_VER=$(npm -v 2>/dev/null)
if [ -n "$NPM_VER" ]; then check "npm" ok "版本 $NPM_VER"; else check "npm" fail "未检测到（随 Node 安装）"; fi

# 3) Git
GIT_VER=$(git --version 2>/dev/null)
if [ -n "$GIT_VER" ]; then check "Git" ok "$GIT_VER"; else check "Git" fail "未安装"; fi

# 4) 项目结构与依赖
SRC="$(cd "$(dirname "$0")" && pwd)/游戏开发组/src"
if [ -f "$SRC/package.json" ]; then
  check "项目结构" ok "找到 package.json"
  if [ -d "$SRC/node_modules" ]; then
    check "依赖安装" ok "node_modules 存在"
    for d in phaser zustand easystarjs; do
      if [ -d "$SRC/node_modules/$d" ]; then check "依赖 $d" ok "已安装"; else check "依赖 $d" fail "缺失，运行 npm install"; fi
    done
  else check "依赖安装" fail "node_modules 不存在，请先 npm install"; fi
else check "项目结构" fail "未找到 package.json"; fi

echo ""
echo "===== 结果：PASS $PASS / FAIL $FAIL ====="
if [ "$FAIL" -eq 0 ]; then echo "环境齐全，可以开始开发！"; else echo "有 $FAIL 项未通过：按 技术栈.md 第三节修复后重跑本脚本。"; fi
