module.exports = {
  apps: [
    {
      name: "twenty-server",
      script: "./pm2_start.sh",
      watch: false,
      env: {
        PORT: 3000,
        NODE_ENV: "development",
      },
      env_production: {
        PORT: 3000,
        NODE_ENV: "production",
      },
    },
    {
      name: "twenty-worker",
      script: "./pm2_start_worker.sh",
      watch: false,
    },
  ],
};
