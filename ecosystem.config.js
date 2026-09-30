module.exports = {
  apps: [
    {
      name: 'noviai-call-system',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      error_file: '/var/log/noviai/error.log',
      out_file: '/var/log/noviai/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
