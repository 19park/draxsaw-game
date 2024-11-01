<!-- layouts/game.vue -->
<template>
  <div class="game-layout">
    <header class="header">
      <nav class="nav">
        <NuxtLink to="/" class="logo">
          드렉사우
        </NuxtLink>
        <div class="nav-links">
          <NuxtLink to="/lobby" class="nav-link">
            게임 로비
          </NuxtLink>
          <button v-if="isLoggedIn"
                  class="nav-link"
                  @click="logout">
            로그아웃
          </button>
        </div>
      </nav>
    </header>

    <main class="main">
      <slot />
    </main>

    <footer class="footer">
      <p>&copy; 2024 드렉사우 온라인</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const isLoggedIn = ref(false) // 실제 인증 상태와 연동 필요

const logout = () => {
  // 로그아웃 로직
  router.push('/')
}
</script>

<style scoped>
.game-layout {
  @apply min-h-screen flex flex-col bg-gray-50;
}

.header {
  @apply bg-white shadow-sm;
}

.nav {
  @apply max-w-7xl mx-auto px-4 h-16 flex justify-between items-center;
}

.logo {
  @apply text-xl font-bold text-blue-600 hover:text-blue-700;
}

.nav-links {
  @apply flex items-center gap-4;
}

.nav-link {
  @apply text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium;
}

.main {
  @apply flex-1;
}

.footer {
  @apply bg-white border-t py-4 text-center text-sm text-gray-600;
}
</style>