// PM2 process config for running aria-RPG on a VM (e.g. Oracle Cloud Always Free).
// Start:   pm2 start ecosystem.config.js
// Logs:    pm2 logs aria-rpg
// Persist: pm2 save && pm2 startup  (run the sudo command it prints)
module.exports = {
  apps: [{
    name: 'aria-rpg',
    script: 'index.js',
    // MUST stay a single fork instance — the WhatsApp session is ONE connection.
    // Never use cluster mode / instances > 1, or you'll get 440 conflicts.
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    // Auto-recover from a memory leak without a manual restart. 24GB VM has room;
    // the app normally uses well under 512MB, so 2G is a safe leak-catch ceiling.
    max_memory_restart: '2G',
    restart_delay: 5000,
    env: { NODE_ENV: 'production' }
  }]
};
