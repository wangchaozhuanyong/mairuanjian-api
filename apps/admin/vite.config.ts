import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, '');
  const devApiProxyTarget = env.VITE_DEV_API_PROXY_TARGET || 'http://localhost:3000';

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: 5374,
      strictPort: true,
      proxy: {
        '/api': {
          target: devApiProxyTarget,
          changeOrigin: true
        }
      }
    }
  };
});
