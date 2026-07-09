module.exports = {
  apps: [
    {
      name: "rcc-hiros",
      script: "scripts/dev-runner.js",
      cwd: "/home/z/my-project/workspace-rcc-hiros",
      env: {
        PORT: "3000",
        NODE_ENV: "development",
      },
      // ── Crash Recovery ──
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      min_uptime: "10s",
      unstable_restarts: 15,

      // ── Memory Management ──
      max_memory_restart: "1500M",

      // ── Graceful Shutdown ──
      kill_timeout: 10000,
      listen_timeout: 30000,

      // ── Logging ──
      error_file: "/home/z/my-project/workspace-rcc-hiros/dev.log",
      out_file: "/home/z/my-project/workspace-rcc-hiros/dev.log",
      merge_logs: true,
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",

      // ── No watch (Next.js has its own HMR) ──
      watch: false,

      // ── Single Instance ──
      instances: 1,
      exec_mode: "fork",
    },
  ],
};
