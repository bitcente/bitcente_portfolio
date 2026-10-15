import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import devLeaderboard from './server/devLeaderboard'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // the tetris leaderboard while developing (in production it's public/api/scores.php). The '' prefix
    // loads every variable of .env.local, they're only used here on the dev server, never sent to the browser
    devLeaderboard(loadEnv(mode, '.', '')),
  ],
}))
