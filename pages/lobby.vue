<!-- pages/lobby.vue -->
<template>
  <div class="lobby-container">
    <h1 class="title">드렉사우 게임 로비</h1>

    <!-- 대기실 화면 -->
    <div v-if="gameStore.currentRoom" class="waiting-room">
      <div class="room-header">
        <h2 class="subtitle">
          대기실 #{{ gameStore.currentRoom.id }}
          <span class="game-mode-badge" :class="gameStore.currentRoom.gameMode">
            {{ gameStore.currentRoom.gameMode === 'basic' ? '기본' : '확장팩' }} 모드
          </span>
        </h2>
        <div class="player-counter">
          {{ gameStore.currentRoom.players.length }}/4 플레이어
        </div>
      </div>

      <div class="players-grid">
        <!-- 현재 참가자 -->
        <div v-for="(player, index) in gameStore.currentRoom.players"
             :key="player.id"
             class="player-slot"
             :class="{ 'ready': player.ready }">
          <div class="player-content">
            <div class="player-avatar">{{ player.name[0].toUpperCase() }}</div>
            <div class="player-info">
              <span class="player-name">
                {{ player.name }}
                <span v-if="player.id === gameStore.currentRoom.owner" class="owner-badge">
                  방장
                </span>
              </span>
              <span class="ready-status" :class="{ 'is-ready': player.ready }">
                {{ player.ready ? '준비 완료!' : '대기 중...' }}
              </span>
            </div>
          </div>
        </div>

        <!-- 빈 슬롯 -->
        <div v-for="i in (4 - gameStore.currentRoom.players.length)"
             :key="`empty-${i}`"
             class="player-slot empty">
          <div class="empty-slot-content">
            <span class="empty-slot-text">빈 자리</span>
          </div>
        </div>
      </div>

      <div class="room-controls">
        <button v-if="isRoomOwner"
                class="start-button"
                :disabled="!canStartGame"
                @click="startGame">
          게임 시작
        </button>
        <button class="ready-button"
                :class="{ 'is-ready': gameStore.isReady }"
                @click="toggleReady">
          {{ gameStore.isReady ? '준비 해제' : '준비하기' }}
        </button>
        <button class="leave-button" @click="leaveRoom">
          나가기
        </button>
      </div>

      <div v-if="!canStartGame && isRoomOwner" class="status-message">
        {{ startGameMessage }}
      </div>
    </div>

    <!-- 로비 화면 -->
    <div v-else class="lobby-content">
      <div class="create-game">
        <h2 class="subtitle">새 게임 만들기</h2>
        <div class="form-group">
          <label>게임 모드</label>
          <select v-model="gameStore.gameMode">
            <option value="basic">기본 게임</option>
            <option value="expansion">확장팩 게임</option>
          </select>
        </div>
        <button class="create-button" @click="createGame">
          게임 만들기
        </button>
      </div>

      <GamesList
        :games="gameStore.games"
        @join="handleJoinGame"
      />
    </div>

    <!-- 소켓 상태 표시 -->
    <div v-if="isDevelopment" class="socket-status">
      <p>Socket Status: {{ socketStatus }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import GamesList from "~/components/game/GamesList.vue"
import { useGameStore } from '~/composables/useGameStore'
import { useSocketEvents } from '~/composables/useSocketEvents'

const router = useRouter()
const { $socket } = useNuxtApp()
const gameStore = useGameStore()
const { setupLobbyEvents, clearEvents } = useSocketEvents()

// 상태 관리
const socketStatus = ref('disconnected')
const isDevelopment = process.env.NODE_ENV === 'development'

// 계산된 속성
const isRoomOwner = computed(() => {
  return gameStore.currentRoom?.owner === $socket.id
})

const canStartGame = computed(() => {
  if (!gameStore.currentRoom) return false
  return gameStore.currentRoom.players.length >= 2 &&
    gameStore.currentRoom.players.every(player => player.ready)
})

const startGameMessage = computed(() => {
  if (!gameStore.currentRoom) return ''
  if (gameStore.currentRoom.players.length < 2) {
    return '최소 2명의 플레이어가 필요합니다'
  }
  if (!gameStore.currentRoom.players.every(player => player.ready)) {
    return '모든 플레이어가 준비를 완료해야 합니다'
  }
  return ''
})

const createGame = () => {
  $socket.emit('createGame', {
    gameMode: gameStore.gameMode,
    maxPlayers: 4
  })
}

const handleJoinGame = (gameId) => {
  const playerName = `Player_${Math.random().toString(36).substring(7)}`
  $socket.emit('joinRoom', {
    roomId: gameId,
    playerName: playerName
  })
  router.push(`/game/${gameId}`)
}

const toggleReady = () => {
  $socket.emit('toggleReady', {
    roomId: gameStore.currentRoom.id,
    ready: !gameStore.isReady
  })
}

const leaveRoom = () => {
  $socket.emit('leaveRoom', { roomId: gameStore.currentRoom.id })
  gameStore.setCurrentRoom(null)
}

const startGame = () => {
  if (!canStartGame.value) return
  $socket.emit('startGame', { roomId: gameStore.currentRoom.id })
}

onMounted(() => {
  setupLobbyEvents()
  gameStore.setLocalPlayerId($socket.id) // 로컬 플레이어 ID 설정

  $socket.on('connect', () => {
    socketStatus.value = 'connected'
    $socket.emit('getGames')
  })

  $socket.on('connect_error', () => {
    socketStatus.value = 'error'
  })

  $socket.on('disconnect', () => {
    socketStatus.value = 'disconnected'
  })
})

onUnmounted(() => {
  clearEvents([
    'gamesList',
    'gameCreated',
    'connect',
    'connect_error',
    'disconnect'
  ])
})
</script>


<style scoped>
/* 기존 스타일 유지 */
.waiting-room {
  @apply bg-white rounded-lg shadow-lg p-6 mb-8;
}

.room-header {
  @apply flex justify-between items-center mb-6;
}

.game-mode-badge {
  @apply ml-2 px-3 py-1 text-sm font-medium rounded-full;
}

.game-mode-badge.basic {
  @apply bg-blue-100 text-blue-800;
}

.game-mode-badge.expansion {
  @apply bg-purple-100 text-purple-800;
}

.players-grid {
  @apply grid grid-cols-2 gap-4 mb-6;
}

.player-slot {
  @apply bg-gray-50 rounded-lg p-4 transition-all duration-200;
}

.player-slot.ready {
  @apply bg-green-50;
}

.player-slot.empty {
  @apply border-2 border-dashed border-gray-300;
}

.player-content {
  @apply flex items-center gap-3;
}

.player-avatar {
  @apply w-10 h-10 rounded-full bg-blue-500 text-white
  flex items-center justify-center font-bold;
}

.player-info {
  @apply flex flex-col;
}

.player-name {
  @apply font-medium;
}

.owner-badge {
  @apply ml-2 px-2 py-0.5 text-xs bg-yellow-100
  text-yellow-800 rounded;
}

.ready-status {
  @apply text-sm text-gray-500;
}

.ready-status.is-ready {
  @apply text-green-600 font-medium;
}

.room-controls {
  @apply flex justify-center gap-4;
}

.start-button {
  @apply px-6 py-2 bg-green-500 text-white rounded-lg
  hover:bg-green-600 disabled:opacity-50
  disabled:cursor-not-allowed transition-colors;
}

.ready-button {
  @apply px-6 py-2 bg-blue-500 text-white rounded-lg
  hover:bg-blue-600 transition-colors;
}

.ready-button.is-ready {
  @apply bg-green-500 hover:bg-green-600;
}

.leave-button {
  @apply px-6 py-2 bg-red-500 text-white rounded-lg
  hover:bg-red-600 transition-colors;
}

.status-message {
  @apply mt-4 text-center text-sm text-gray-600;
}

.empty-slot-content {
  @apply h-full flex items-center justify-center;
}

.empty-slot-text {
  @apply text-gray-400 text-sm;
}

.lobby-container {
  @apply max-w-4xl mx-auto p-8;
}

.title {
  @apply text-3xl font-bold text-center mb-8;
}

.subtitle {
  @apply text-xl font-semibold mb-4;
}

.create-game {
  @apply mb-8 p-6 bg-white rounded-lg shadow;
}

.form-group {
  @apply mb-4;
}

.form-group label {
  @apply block text-sm font-medium text-gray-700 mb-2;
}

.form-group select {
  @apply w-full p-2 border rounded;
}

.create-button {
  @apply w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600
  transition-colors;
}

.games-list {
  @apply space-y-4;
}

.game-item {
  @apply flex justify-between items-center p-4 bg-white rounded-lg shadow;
}

.game-info {
  @apply flex gap-4 items-center;
}

.game-id {
  @apply font-medium;
}

.player-count {
  @apply text-sm text-gray-500;
}

.game-mode {
  @apply text-sm text-gray-500;
}

.join-button {
  @apply px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600
  transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.no-games {
  @apply text-center text-gray-500 py-8;
}

.socket-status {
  @apply fixed bottom-4 right-4 p-2 bg-gray-800 text-white rounded-lg
  text-sm opacity-75;
}
</style>