module.exports = {
  apps: [
    {
      name: 'tim-bridge',
      script: 'src/index.js',
      instances: 1,
      autorestart: true,
      watch: true,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
