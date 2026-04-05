const { spawn } = require('child_process');
const path = require('path');

console.log('\n========================================');
console.log('  X-Thread 2.0 - 启动中');
console.log('========================================\n');

// 启动后端
console.log('[1/2] 启动后端服务 (端口 3001)...');
const backend = spawn('pnpm', ['dev'], {
  cwd: path.join(__dirname, 'backend'),
  shell: true,
  stdio: 'inherit'
});

backend.on('close', (code) => {
  console.log('后端进程已退出');
  process.exit(code);
});

// 等待2秒后启动前端
setTimeout(() => {
  console.log('\n[2/2] 启动前端服务 (端口 5173)...');
  const frontend = spawn('pnpm', ['dev'], {
    cwd: path.join(__dirname, 'frontend'),
    shell: true,
    stdio: 'inherit'
  });

  frontend.on('close', (code) => {
    console.log('前端进程已退出');
    backend.kill();
    process.exit(code);
  });

  console.log('\n========================================');
  console.log('  ✅ 服务已启动！');
  console.log('========================================');
  console.log('\n  后端地址: http://localhost:3001');
  console.log('  前端地址: http://localhost:5173');
  console.log('\n  按 Ctrl+C 停止所有服务\n');

}, 2000);

// 处理Ctrl+C
process.on('SIGINT', () => {
  console.log('\n正在停止所有服务...');
  backend.kill();
  process.exit(0);
});

