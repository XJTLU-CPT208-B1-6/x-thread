# X-Thread 2.0 启动脚本
# 同时启动前端和后端

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  X-Thread 2.0 - 启动中" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 设置执行策略（当前进程）
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -ErrorAction SilentlyContinue

$backendEnvPath = Join-Path $PSScriptRoot "backend\.env"
$rootEnvExamplePath = Join-Path $PSScriptRoot ".env.example"

if (-not (Test-Path $backendEnvPath)) {
    if (-not (Test-Path $rootEnvExamplePath)) {
        Write-Host "  ✗ 缺少 backend/.env 和根目录 .env.example，无法自动初始化环境变量" -ForegroundColor Red
        exit 1
    }

    Write-Host "[0/3] backend/.env 不存在，正在从 .env.example 自动创建..." -ForegroundColor Yellow
    Copy-Item -LiteralPath $rootEnvExamplePath -Destination $backendEnvPath
    Write-Host "  ✓ backend/.env 已创建" -ForegroundColor Green
    Write-Host ""
}

# 检查Docker容器是否运行
Write-Host "[1/3] 检查Docker容器状态..." -ForegroundColor Yellow
try {
    $dockerStatus = docker compose ps --services --filter "status=running" 2>$null
    if ($dockerStatus -match "postgres" -and $dockerStatus -match "redis" -and $dockerStatus -match "minio") {
        Write-Host "  ✓ Docker容器已运行" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ Docker容器未完全运行，尝试启动..." -ForegroundColor Yellow
        docker compose up -d
        Start-Sleep -Seconds 3
        Write-Host "  ✓ Docker容器已启动" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠ 无法检查Docker状态，请确保Docker正在运行" -ForegroundColor Yellow
}

Write-Host ""

# 启动后端
Write-Host "[2/3] 启动后端服务 (端口 3001)..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\backend
    pnpm dev
}
Start-Sleep -Seconds 5

# 检查后端是否启动成功
$backendOutput = Receive-Job -Job $backendJob
if ($backendOutput -match "error" -or $backendOutput -match "Error") {
    Write-Host "  ✗ 后端启动失败，请检查错误" -ForegroundColor Red
    Receive-Job -Job $backendJob
    Stop-Job -Job $backendJob
    Remove-Job -Job $backendJob
    exit 1
}
Write-Host "  ✓ 后端已启动" -ForegroundColor Green
Write-Host ""

# 启动前端
Write-Host "[3/3] 启动前端服务 (端口 5173)..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\frontend
    pnpm dev
}
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ X-Thread 2.0 已成功启动！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  后端地址: http://localhost:3001" -ForegroundColor Cyan
Write-Host "  前端地址: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "  按 Ctrl+C 停止所有服务" -ForegroundColor Gray
Write-Host ""

# 等待用户中断
try {
    while ($true) {
        Start-Sleep -Seconds 1
        
        # 检查Job状态
        if ($backendJob.State -ne "Running") {
            Write-Host ""
            Write-Host "后端服务已停止，正在关闭..." -ForegroundColor Red
            break
        }
        if ($frontendJob.State -ne "Running") {
            Write-Host ""
            Write-Host "前端服务已停止，正在关闭..." -ForegroundColor Red
            break
        }
    }
} finally {
    # 清理Job
    Write-Host ""
    Write-Host "正在停止所有服务..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
    Remove-Job -Job $frontendJob -Force -ErrorAction SilentlyContinue
    Write-Host "✓ 所有服务已停止" -ForegroundColor Green
}

