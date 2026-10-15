import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import devLeaderboard from './server/devLeaderboard'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // changes with every build: added to the urls of files in public/ that get replaced (?v=), so Cloudflare and the
  // browsers, which keep them for days, ask for the new ones after a deploy
  define: {
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
  plugins: [
    react(),
    // the tetris leaderboard while developing (in production it's public/api/scores.php). The '' prefix
    // loads every variable of .env.local, they're only used here on the dev server, never sent to the browser
    devLeaderboard(loadEnv(mode, '.', '')),
  ],
}))
