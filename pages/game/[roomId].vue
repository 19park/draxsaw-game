<!-- pages/game/[roomId].vue -->
<template>
  <div class="game-room">
    <!-- 대기실 상태 -->
    <div v-if="gameStore.status === 'waiting'" class="waiting-room">
      <div class="room-info">
        <h2 class="title">게임 대기실 #{{ roomId }}</h2>
        <div class="game-mode-badge" :class="gameStore.gameMode">
          {{ gameStore.gameMode === 'basic' ? '기본' : '확장팩' }} 모드
        </div>
      </div>

      <!-- 플레이어 목록 -->
      <div class="players-container">
        <div class="players-grid">
          <div v-for="player in gameStore.players"
               :key="player.id"
               class="player-card"
               :class="{
                 'ready': player.ready,
                 'is-me': isCurrentPlayer(player.id)
               }">
            <div class="player-content">
              <div class="player-avatar">
                {{ player.name[0].toUpperCase() }}
              </div>
              <div class="player-info">
                <div class="player-name">
                  {{ player.name }}
                  <span v-if="isRoomOwner(player.id)" class="owner-badge">방장</span>
                  <span v-if="isCurrentPlayer(player.id)" class="me-badge">나</span>
                </div>
                <div class="ready-status" :class="{ 'is-ready': player.ready }">
                  {{ player.ready ? '준비 완료!' : '준비해주세요...' }}
                </div>
              </div>
            </div>
          </div>

          <!-- 빈 슬롯 -->
          <div v-for="i in (4 - gameStore.players.length)"
               :key="`empty-${i}`"
               class="player-card empty">
            <div class="empty-slot">
              다른 플레이어 대기중...
            </div>
          </div>
        </div>
      </div>

      <!-- 게임 컨트롤 -->
      <div class="game-controls">
        <button v-if="amIOwner"
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

      <!-- 상태 메시지 -->
      <div v-if="statusMessage" class="status-message" :class="messageType">
        {{ statusMessage }}
      </div>
    </div>

    <!-- 게임 진행 상태 -->
    <GameBoard
      v-else-if="gameStore.status === 'playing'"
      :room-id="roomId"
      :current-player-id="$socket.id"
      :players="gameStore.players"
      :game-mode="gameStore.gameMode"
    />

    <!-- 게임 종료 상태 -->
    <div v-else-if="gameStore.status === 'finished'" class="game-result">
      <h2 class="title">게임 종료!</h2>
      <div v-if="gameStore.winner" class="winner-info">
        승자: {{ gameStore.winner.name }}
      </div>
      <div class="result-controls">
        <button v-if="amIOwner"
                class="rematch-button"
                @click="requestRematch">
          다시하기
        </button>
        <button class="to-lobby-button" @click="goToLobby">
          로비로 가기
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GameBoard from '~/components/game/GameBoard.vue'
import { useGameStore } from '~/composables/useGameStore'
import { useSocketEvents } from '~/composables/useSocketEvents'

const route = useRoute()
const router = useRouter()
const { $socket } = useNuxtApp()
const gameStore = useGameStore()
const { setupRoomEvents, clearEvents } = useSocketEvents()

// 상태 관리
const roomId = ref(route.params.roomId)
const statusMessage = ref('')
const messageType = ref('info')

// 계산된 속성
const amIOwner = computed(() => {
  return gameStore.currentRoom?.owner === $socket.id
})

const canStartGame = computed(() => {
  return gameStore.players.length >= 2 &&
    gameStore.players.every(player => player.ready)
})

// 메서드
const isCurrentPlayer = (playerId) => {
  return playerId === $socket.id
}

const isRoomOwner = (playerId) => {
  return playerId === gameStore.currentRoom?.owner
}

const showMessage = (message, type = 'info') => {
  statusMessage.value = message
  messageType.value = type
  setTimeout(() => {
    statusMessage.value = ''
  }, 3000)
}

const toggleReady = () => {
  $socket.emit('toggleReady', {
    roomId: roomId.value,
    ready: !gameStore.isReady
  })
}

const startGame = () => {
  if (!canStartGame.value) {
    showMessage('모든 플레이어가 준비를 완료해야 합니다', 'error')
    return
  }

  $socket.emit('startGame', {
    roomId: roomId.value
  })
}

const leaveRoom = () => {
  $socket.emit('leaveRoom', { roomId: roomId.value })
  router.push('/lobby')
}

const requestRematch = () => {
  $socket.emit('requestRematch', { roomId: roomId.value })
}

const goToLobby = () => {
  router.push('/lobby')
}

onMounted(() => {
  setupRoomEvents()

  // 방 참여 요청
  $socket.emit('joinRoom', {
    roomId: roomId.value,
    playerName: `Player_${Math.random().toString(36).substring(7)}`
  })
})

onUnmounted(() => {
  clearEvents([
    'roomState',
    'roomUpdated',
    'playerLeft'
  ])
})

// 상태 변화 감시
watch(() => gameStore.status, (newState, oldState) => {
  console.log('Game state changed:', { from: oldState, to: newState })
})

watch(() => gameStore.players, (newPlayers) => {
  console.log('Players updated:', newPlayers)
})
</script>

<style scoped>
.game-room {
  @apply min-h-screen bg-gray-50 p-4;
}

.waiting-room {
  @apply max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6;
}

.room-info {
  @apply flex justify-between items-center mb-6;
}

.title {
  @apply text-2xl font-bold;
}

.game-mode-badge {
  @apply px-3 py-1 rounded-full text-sm font-medium;
}

.game-mode-badge.basic {
  @apply bg-blue-100 text-blue-800;
}

.game-mode-badge.expansion {
  @apply bg-purple-100 text-purple-800;
}

.players-container {
  @apply mb-8;
}

.players-grid {
  @apply grid grid-cols-2 gap-4;
}

.player-card {
  @apply bg-gray-50 rounded-lg p-4 transition-all duration-200;
}

.player-card.ready {
  @apply bg-green-50;
}

.player-card.is-me {
  @apply ring-2 ring-blue-400;
}

.player-card.empty {
  @apply border-2 border-dashed border-gray-300 flex items-center justify-center;
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
  @apply font-medium flex items-center gap-2;
}

.owner-badge {
  @apply px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded;
}

.me-badge {
  @apply px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded;
}

.ready-status {
  @apply text-sm text-gray-500;
}

.ready-status.is-ready {
  @apply text-green-600 font-medium;
}

.game-controls {
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
  @apply mt-4 text-center text-sm rounded-lg p-2;
}

.status-message.info {
  @apply bg-blue-100 text-blue-800;
}

.status-message.error {
  @apply bg-red-100 text-red-800;
}

.empty-slot {
  @apply text-gray-400 text-sm;
}

.game-result {
  @apply max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6 text-center;
}

.winner-info {
  @apply text-xl font-bold my-4;
}

.result-controls {
  @apply flex justify-center gap-4 mt-6;
}

.rematch-button {
  @apply px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600;
}

.to-lobby-button {
  @apply px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600;
}
</style>