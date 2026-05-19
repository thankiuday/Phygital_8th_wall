/**
 * PM2 ecosystem — run from repo root:
 *   pm2 start deploy/pm2.ecosystem.config.cjs
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'phygital-api',
      cwd: './server',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      error_file: '/var/log/phygital/api-error.log',
      out_file: '/var/log/phygital/api-out.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'phygital-scan-worker',
      cwd: './server',
      script: 'src/workers/scanWorker.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_memory_restart: '256M',
      error_file: '/var/log/phygital/scan-worker-error.log',
      out_file: '/var/log/phygital/scan-worker-out.log',
    },
    {
      name: 'phygital-render-worker',
      cwd: './server',
      script: 'src/workers/cardRenderWorker.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_memory_restart: '1G',
      error_file: '/var/log/phygital/render-worker-error.log',
      out_file: '/var/log/phygital/render-worker-out.log',
    },
  ],
};
