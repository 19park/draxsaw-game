<!-- app.vue -->
<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useSocketEvents } from '~/composables/useSocketEvents'

const { setupGlobalEvents, clearEvents } = useSocketEvents()

onMounted(() => {
  setupGlobalEvents()
})

onUnmounted(() => {
  clearEvents([
    'connect',
    'error',
    'gameStateUpdated',
    'gameStarted',
    'gameEnded'
  ])
})
</script>

<style>
body {
  @apply bg-gray-50 min-h-screen;
}
</style>