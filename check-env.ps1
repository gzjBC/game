# 《High》环境检查脚本 —— 每次开发前运行
$ErrorActionPreference = 'SilentlyContinue'
$pass = 0; $fail = 0
function Check($name, $ok, $detail) {
    if ($ok) { $script:pass++; Write-Host "[PASS] $name - $detail" -ForegroundColor Green }
    else { $script:fail++; Write-Host "[FAIL] $name - $detail" -ForegroundColor Red }
}
Write-Host "===== 《High》环境检查 =====" -ForegroundColor Cyan
# 1) Node.js
$node = node -v 2>$null
if ($node -match '^v(\d+)') {
    $ver = [int]$Matches[1]
    if ($ver -ge 20) { Check "Node.js" $true "已安装 $node（>=20 OK）" } else { Check "Node.js" $false "已安装 $node 但版本 < 20，请升级到 20 LTS" }
} else { Check "Node.js" $false "未检测到，请安装 https://nodejs.org/" }
# 2) npm
$npm = npm -v 2>$null
if ($npm) { Check "npm" $true "版本 $npm" } else { Check "npm" $false "未检测到（随 Node 一起安装）" }
# 3) Git
$git = git --version 2>$null
if ($git) { Check "Git" $true $git } else { Check "Git" $false "未安装，请安装 https://git-scm.com/" }
# 4) 项目结构与依赖
$src = Join-Path $PSScriptRoot '游戏开发组\src'
$pkg = Join-Path $src 'package.json'
if (Test-Path $pkg) {
    Check "项目结构" $true "找到 package.json"
    if (Test-Path (Join-Path $src 'node_modules')) {
        Check "依赖安装" $true "node_modules 存在"
        $deps = @('phaser','zustand','tailwindcss','easystarjs','break_infinity.js')
        foreach ($d in $deps) {
            if (Test-Path (Join-Path $src "node_modules\$d")) { Check "依赖 $d" $true "已安装" } else { Check "依赖 $d" $false "缺失，运行 npm install" }
        }
    } else { Check "依赖安装" $false "node_modules 不存在，请先 npm install" }
} else { Check "项目结构" $false "未找到 package.json（里程碑 0 尚未创建 Vite 项目）" }
Write-Host ""
Write-Host "===== 结果：PASS $pass / FAIL $fail ====="
if ($fail -eq 0) { Write-Host "环境齐全，可以开始开发！" -ForegroundColor Green }
else { Write-Host "有 $fail 项未通过：按 技术栈.md 第三节修复后重跑本脚本。" -ForegroundColor Yellow }