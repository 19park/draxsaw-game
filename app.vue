// app.vue
<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup>
import { useGameStore } from '~/composables/useGameStore'

const { $socket } = useNuxtApp()
const gameStore = useGameStore()

// 웹소켓 이벤트 리스너 설정
onMounted(() => {
  $socket.on('connect', () => {
    console.log('Connected to server')
  })

  $socket.on('error', ({ message }) => {
    gameStore.setError(message)
  })

  $socket.on('gameStateUpdated', (newState) => {
    gameStore.updateGameState(newState)
  })

  $socket.on('gameStarted', (initialState) => {
    gameStore.initializeGame(
      initialState.roomId,
      initialState.players,
      initialState.gameMode
    )
  })

  $socket.on('gameEnded', ({ winner }) => {
    gameStore.status = 'finished'
    gameStore.setGameMessage(`게임 종료! 승자: ${winner.name}`)
  })
})

onUnmounted(() => {
  // 이벤트 리스너 정리
  $socket.off('connect')
  $socket.off('error')
  $socket.off('gameStateUpdated')
  $socket.off('gameStarted')
  $socket.off('gameEnded')
})
</script>

<style>
body {
  @apply bg-gray-50 min-h-screen;
}
</style>