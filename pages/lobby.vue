<!-- pages/lobby.vue -->
<template>
  <div class="lobby-container">
    <h1 class="title">드렉사우 게임 로비</h1>

    <!-- 대기실 화면 -->
    <div v-if="gameStore.currentRoom" class="waiting-room">
      <div class="room-header">
        <h2 class="subtitle">
          대기실 #{{ gameStore.roomState.roomId }}
          <span
            class="game-mode-badge"
            :class="gameStore.roomState.gameMode"
          >
            {{ gameStore.roomState.gameMode === 'basic' ? '기본' : '확장팩' }} 모드
          </span>
        </h2>
        <div class="player-counter">
          {{ playerCount }}/{{ gameStore.roomState.maxPlayers }} 플레이어
        </div>
      </div>

      <div class="players-grid">
        <!-- 현재 참가자 -->
        <div
          v-for="player in gameStore.roomPlayers"
          :key="player.id"
          class="player-slot"
          :class="{
            'ready': player.ready,
            'is-me': isCurrentPlayer(player.id)
          }"
        >
          <div class="player-content">
            <div class="player-avatar">{{ getPlayerInitial(player.name) }}</div>
            <div class="player-info">
              <span class="player-name">
                {{ player.name }}
                <span v-if="isRoomOwner(player.id)" class="owner-badge">
                  방장
                </span>
              </span>
              <span
                class="ready-status"
                :class="{ 'is-ready': player.ready }"
              >
                {{ player.ready ? '준비 완료!' : '대기 중...' }}
              </span>
            </div>
          </div>
        </div>

        <!-- 빈 슬롯 -->
        <div
          v-for="i in remainingSlots"
          :key="`empty-${i}`"
          class="player-slot empty"
        >
          <div class="empty-slot-content">
            <span class="empty-slot-text">빈 자리</span>
          </div>
        </div>
      </div>

      <div class="room-controls">
        <button
          v-if="isOwner"
          class="start-button"
          :disabled="!canStartGame"
          @click="startGame"
        >
          게임 시작
        </button>
        <button
          class="ready-button"
          :class="{ 'is-ready': gameStore.roomState.isReady }"
          @click="toggleReady"
        >
          {{ gameStore.roomState.isReady ? '준비 해제' : '준비하기' }}
        </button>
        <button class="leave-button" @click="leaveRoom">
          나가기
        </button>
      </div>

      <div v-if="!canStartGame && isOwner" class="status-message">
        {{ startGameMessage }}
      </div>
    </div>

    <!-- 로비 화면 -->
    <div v-else class="lobby-content">
      <div class="create-game">
        <h2 class="subtitle">새 게임 만들기</h2>
        <div class="form-group">
          <label>게임 모드</label>
          <select v-model="selectedGameMode" class="mode-select">
            <option value="basic">기본 게임</option>
            <option value="expansion">확장팩 게임</option>
          </select>
        </div>
        <div class="form-group">
          <label>최대 인원</label>
          <select v-model="maxPlayers" class="players-select">
            <option v-for="n in 3" :key="n" :value="n + 2">
              {{ n + 2 }}명
            </option>
          </select>
        </div>
        <button
          class="create-button"
          @click="createGame"
          :disabled="!isConnected"
        >
          {{ isConnected ? '게임 만들기' : '연결 중...' }}
        </button>
      </div>

      <GamesList
        :games="gameStore.games"
        @join="handleJoinGame"
        @refresh="refreshGames"
      />
    </div>

    <!-- 소켓 상태 표시 -->
    <div class="socket-status">
      <div :class="['status-indicator', socketStatus.status]">
        {{ getStatusMessage }}
      </div>
      <p v-if="socketStatus.error" class="error-message">
        {{ socketStatus.error }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import GamesList from "~/components/game/GamesList.vue"
import { useGameStore } from '~/composables/useGameStore'
import { useSocketEvents } from '~/composables/useSocketEvents'
import { useSocketStatus } from '~/composables/useSocketStatus'

const router = useRouter()
const { $socket } = useNuxtApp()
const gameStore = useGameStore()
const { setupLobbyEvents, clearEvents } = useSocketEvents()
const socketStatus = useSocketStatus()

// 상태 관리
const selectedGameMode = ref('basic')
const maxPlayers = ref(4)
const refreshInterval = ref(null)

// computed 속성들
const isConnected = computed(() => socketStatus.status.value === 'connected')

const getStatusMessage = computed(() => {
  switch (socketStatus.status.value) {
    case 'connected':
      return '서버와 연결됨'
    case 'disconnected':
      return '연결 끊김'
    case 'error':
      return '연결 오류'
    default:
      return '연결 중...'
  }
})

const isOwner = computed(() => gameStore.isRoomOwner)

const playerCount = computed(() => gameStore.roomPlayers.length)

const remainingSlots = computed(() =>
  gameStore.roomState.maxPlayers - playerCount.value
)

const canStartGame = computed(() => {
  return playerCount.value >= 2 &&
    gameStore.roomPlayers.every(player => player.ready)
})

const startGameMessage = computed(() => {
  if (playerCount.value < 2) {
    return '최소 2명의 플레이어가 필요합니다'
  }
  if (!gameStore.roomPlayers.every(player => player.ready)) {
    return '모든 플레이어가 준비를 완료해야 합니다'
  }
  return ''
})
// methods
const isCurrentPlayer = (playerId) => {
  return playerId === $socket?.id
}

const isRoomOwner = (playerId) => {
  return playerId === gameStore.roomState.owner
}

const getPlayerInitial = (name) => {
  return name ? name[0].toUpperCase() : '?'
}

const generatePlayerName = () => {
  return `Player_${Math.random().toString(36).substring(7)}`
}

// 게임 액션 메서드들
const createGame = () => {
  if (!isConnected.value) {
    socketStatus.error.value = '서버와 연결되지 않았습니다.'
    return
  }

  console.log('Creating new game...')
  $socket.emit('createGame', {
    gameMode: selectedGameMode.value,
    maxPlayers: maxPlayers.value
  })
}

const handleJoinGame = (gameId) => {
  if (!isConnected.value) {
    socketStatus.error.value = '서버와 연결되지 않았습니다.'
    return
  }

  const playerName = generatePlayerName()
  $socket.emit('joinRoom', {
    roomId: gameId,
    playerName
  })
  router.push(`/game/${gameId}`)
}

const toggleReady = () => {
  if (!gameStore.roomState.roomId || !isConnected.value) return

  $socket.emit('toggleReady', {
    roomId: gameStore.roomState.roomId,
    ready: !gameStore.roomState.isReady
  })
}

const leaveRoom = async () => {
  if (gameStore.roomState.roomId && isConnected.value) {
    $socket.emit('leaveRoom', {
      roomId: gameStore.roomState.roomId
    })
    gameStore.leaveRoom()
  }
  await router.push('/lobby')
}

const startGame = () => {
  if (!canStartGame.value || !isConnected.value) return

  $socket.emit('startGame', {
    roomId: gameStore.roomState.roomId
  })
}

const refreshGames = () => {
  if (isConnected.value) {
    $socket.emit('getGames')
  }
}

// 게임 목록 자동 갱신 설정
const setupGameListRefresh = () => {
  refreshGames()

  refreshInterval.value = setInterval(() => {
    if (isConnected.value) {
      refreshGames()
    }
  }, 3000)
}

// Lifecycle hooks
onMounted(() => {
  socketStatus.setupSocketListeners()
  setupLobbyEvents()
  setupGameListRefresh()

  // 연결 상태 변화 감시
  watch(() => socketStatus.status.value, (newStatus) => {
    console.log('Socket status changed:', newStatus)
    if (newStatus === 'connected') {
      refreshGames()
    }
  })
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
  socketStatus.clearSocketListeners()
  clearEvents([
    'gamesList',
    'gameCreated',
    'connect',
    'connect_error',
    'disconnect'
  ])
})

// 스타일
</script>

<style scoped>
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

.mode-select, .players-select {
  @apply w-full p-2 border rounded-lg shadow-sm
  focus:ring-2 focus:ring-blue-500 focus:border-blue-500;
}

.create-button {
  @apply w-full py-2 bg-blue-500 text-white rounded-lg
  hover:bg-blue-600 transition-colors
  disabled:opacity-50 disabled:cursor-not-allowed;
}

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
  @apply font-medium flex items-center gap-2;
}

.owner-badge {
  @apply ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded;
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

.socket-status {
  @apply fixed bottom-4 right-4 p-3 bg-gray-800 text-white rounded-lg
  shadow-lg opacity-75 transition-all duration-300;
}

.status-indicator {
  @apply flex items-center gap-2 font-medium;
}

.status-indicator::before {
  content: '';
  @apply w-2 h-2 rounded-full;
}

.status-indicator.connected::before {
  @apply bg-green-400;
}

.status-indicator.disconnected::before {
  @apply bg-red-400;
}

.status-indicator.error::before {
  @apply bg-yellow-400;
}

.error-message {
  @apply text-xs text-red-300 mt-2;
}
</style>