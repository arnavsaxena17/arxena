module.exports = {
    apps: [
      {
        name: "twenty-server",
        script: "./pm2_start_server.sh",
        watch: false,
        env: {
          PORT: 3000,
          NODE_ENV: "production",
          NODE_OPTIONS: "--max-old-space-size=4096",
        },
        env_production: {
          PORT: 3000,
          NODE_ENV: "production",
          NODE_OPTIONS: "--max-old-space-size=4096",
        },
      },
      {
        name: "twenty-worker",
        script: "./pm2_start_worker.sh",
        watch: false,
      },
    ],
  };