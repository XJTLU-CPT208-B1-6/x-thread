const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const rootEnvExamplePath = path.join(projectRoot, '.env.example');
const backendEnvPath = path.join(projectRoot, 'backend', '.env');
let backend;
let frontend;

function printStep(message) {
  console.log(`[setup] ${message}`);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? projectRoot,
    encoding: 'utf8',
    shell: true,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  return result;
}

function stopChild(child) {
  if (child && !child.killed) {
    child.kill();
  }
}

function exitWithFailure(result) {
  process.exit(result.status ?? 1);
}

function ensureBackendEnv() {
  if (!fs.existsSync(backendEnvPath)) {
    if (!fs.existsSync(rootEnvExamplePath)) {
      console.error(
        'Missing backend/.env and root .env.example. Cannot bootstrap the default backend environment.',
      );
      process.exit(1);
    }

    printStep('backend/.env is missing. Bootstrapping it from .env.example...');
    fs.copyFileSync(rootEnvExamplePath, backendEnvPath);
  }
}

function ensureDatabaseReady() {
  printStep('Applying backend Prisma migrations...');
  let result = runCommand('corepack', [
    'pnpm',
    '--filter',
    'x-thread-backend',
    'exec',
    'prisma',
    'migrate',
    'deploy',
  ]);
  if (result.status === 0) {
    return;
  }

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (!/P1001|Can't reach database server/i.test(output)) {
    exitWithFailure(result);
  }

  printStep('Database is unavailable. Trying docker compose up -d...');
  result = runCommand('docker', ['compose', 'up', '-d']);
  if (result.status !== 0) {
    exitWithFailure(result);
  }

  printStep('Retrying backend Prisma migrations...');
  result = runCommand('corepack', [
    'pnpm',
    '--filter',
    'x-thread-backend',
    'exec',
    'prisma',
    'migrate',
    'deploy',
  ]);
  if (result.status !== 0) {
    exitWithFailure(result);
  }
}

function startServices() {
  console.log('\n========================================');
  console.log('  X-Thread 2.0 - Starting Dev Services');
  console.log('========================================\n');

  console.log('[1/2] Starting backend service on port 3001...');
  backend = spawn('pnpm', ['dev'], {
    cwd: path.join(projectRoot, 'backend'),
    shell: true,
    stdio: 'inherit',
  });

  backend.on('close', (code) => {
    console.log('Backend process exited.');
    stopChild(frontend);
    process.exit(code ?? 0);
  });

  setTimeout(() => {
    console.log('\n[2/2] Starting frontend service on port 5173...');
    frontend = spawn('pnpm', ['dev'], {
      cwd: path.join(projectRoot, 'frontend'),
      shell: true,
      stdio: 'inherit',
    });

    frontend.on('close', (code) => {
      console.log('Frontend process exited.');
      stopChild(backend);
      process.exit(code ?? 0);
    });

    console.log('\n========================================');
    console.log('  Services are ready');
    console.log('========================================');
    console.log('\n  Backend:  http://localhost:3001');
    console.log('  Frontend: http://localhost:5173');
    console.log('\n  Press Ctrl+C to stop both services.\n');
  }, 2000);
}

ensureBackendEnv();
ensureDatabaseReady();
startServices();

process.on('SIGINT', () => {
  console.log('\nStopping services...');
  stopChild(frontend);
  stopChild(backend);
  process.exit(0);
});
