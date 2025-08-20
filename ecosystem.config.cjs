module.exports = {
  apps: [
    {
      name: 'kijko-backend',
      script: './backend/server.js',
      cwd: '/home/user/webapp/kijko-mvp',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};