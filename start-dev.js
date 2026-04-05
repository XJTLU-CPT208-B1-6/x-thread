const { spawn } = require('child_process');
const path = require('path');

console.log('\n========================================');
console.log('  X-Thread 2.0 - 启动中');
console.log('========================================\n');

// 颜色输出
const colors = {
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

let backendReady = false;
let frontendReady = false;

// 启动后端
console.log(`${colors.yellow}[1/2] 启动后端服务 (端口 3001)...${colors.reset}`);
const backend = spawn('pnpm', ['dev'], {
  cwd: path.join(__dirname, 'backend'),
  shell: true,
  stdio: ['inherit', 'pipe', 'pipe']
});

backend.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`${colors.cyan}[后端]${colors.reset} ${output.trim()}`);
  
  if (output.includes('X-Thread backend running') || output.includes('listening')) {
    backendReady = true;
    checkReady();
  }
});

backend.stderr.on('data', (data) => {
  console.log(`${colors.red}[后端错误]${colors.reset} ${data.toString().trim()}`);
});

backend.on('close', (code) => {
  console.log(`${colors.red}后端进程已退出，代码: ${code}${colors.reset}`);
  process.exit(code);
});

// 等待一下，然后启动前端
setTimeout(() => {
  console.log(`\n${colors.yellow}[2/2] 启动前端服务 (端口 5173)...${colors.reset}`);
  const frontend = spawn('pnpm', ['dev'], {
    cwd: path.join(__dirname, 'frontend'),
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe']
  });

  frontend.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`${colors.cyan}[前端]${colors.reset} ${output.trim()}`);
    
    if (output.includes('Local:') || output.includes('ready')) {
      frontendReady = true;
      checkReady();
    }
  });

  frontend.stderr.on('data', (data) => {
    console.log(`${colors.red}[前端错误]${colors.reset} ${data.toString().trim()}`);
  });

  frontend.on('close', (code) => {
    console.log(`${colors.red}前端进程已退出，代码: ${code}${colors.reset}`);
    backend.kill();
    process.exit(code);
  });

}, 2000);

function checkReady() {
  if (backendReady && frontendReady) {
    console.log(`\n${colors.green}========================================`);
    console.log('  ✅ X-Thread 2.0 已成功启动！');
    console.log('========================================');
    console.log(`\n  后端地址: http://localhost:3001`);
    console.log(`  前端地址: http://localhost:5173`);
    console.log(`\n  按 Ctrl+C 停止所有服务${colors.reset}\n`);
  }
}

// 处理Ctrl+C
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}正在停止所有服务...${colors.reset}`);
  backend.kill();
  process.exit(0);
});

