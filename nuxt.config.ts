// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: false },
  modules: [
    '@pinia/nuxt',
    '@nuxtjs/tailwindcss',
  ],
  css: ['~/assets/css/main.css'],
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
  app: {
    head: {
      title: '드렉사우 온라인',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    }
  },

  nitro: {
    routeRules: {
      '/socket.io/**': {
        proxy: 'http://localhost:3001/socket.io/**'
      }
    }
  },

  runtimeConfig: {
    public: {
      wsUrl: process.env.NUXT_PUBLIC_WS_URL || 'http://localhost:3001',
      wsPath: '/socket.io/'
    }
  },

  vite: {
    server: {
      proxy: {
        '/socket.io': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          ws: true
        }
      }
    }
  },

  // 개발 서버 설정
  devServer: {
    port: 3000,
    host: 'localhost'
  }
})