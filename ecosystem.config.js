export default {
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
      },
      log_file: './logs/kijko-backend.log',
      out_file: './logs/kijko-backend-out.log',
      error_file: './logs/kijko-backend-error.log',
      time: true
    },
    {
      name: 'kijko-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: '/home/user/webapp/kijko-mvp/frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      log_file: './logs/kijko-frontend.log',
      out_file: './logs/kijko-frontend-out.log',
      error_file: './logs/kijko-frontend-error.log',
      time: true
    }
  ]
}