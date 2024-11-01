<!-- pages/lobby.vue -->
<template>
  <div class="lobby-container">
    <h1 class="title">드렉사우 게임 로비</h1>

    <!-- 대기실 화면 -->
    <div v-if="currentRoom" class="waiting-room">
      <div class="room-header">
        <h2 class="subtitle">
          대기실 #{{ currentRoom.id }}
          <span class="game-mode-badge" :class="currentRoom.gameMode">
            {{ currentRoom.gameMode === 'basic' ? '기본' : '확장팩' }} 모드
          </span>
        </h2>
        <div class="player-counter">
          {{ currentRoom.players.length }}/4 플레이어
        </div>
      </div>

      <div class="players-grid">
        <!-- 현재 참가자 -->
        <div v-for="(player, index) in currentRoom.players"
             :key="player.id"
             class="player-slot"
             :class="{ 'ready': player.ready }">
          <div class="player-content">
            <div class="player-avatar">{{ player.name[0].toUpperCase() }}</div>
            <div class="player-info">
              <span class="player-name">
                {{ player.name }}
                <span v-if="player.id === currentRoom.owner" class="owner-badge">
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
        <div v-for="i in (4 - currentRoom.players.length)"
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
                :class="{ 'is-ready': isReady }"
                @click="toggleReady">
          {{ isReady ? '준비 해제' : '준비하기' }}
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
          <select v-model="gameMode">
            <option value="basic">기본 게임</option>
            <option value="expansion">확장팩 게임</option>
          </select>
        </div>
        <button class="create-button" @click="createGame">
          게임 만들기
        </button>
      </div>

      <GamesList
        :games="games"
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
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import GamesList from "~/components/game/GamesList.vue";

const router = useRouter()
const { $socket } = useNuxtApp()
const { isConnected, connectionError, reconnectAttempts } = useSocketStatus()

// 상태 관리
const gameMode = ref('basic')
const games = ref([])
const socketStatus = ref('disconnected')
const isDevelopment = process.env.NODE_ENV === 'development'
const currentRoom = ref(null)

// 계산된 속성
const isRoomOwner = computed(() => {
  return currentRoom.value?.owner === $socket.id
})

const canStartGame = computed(() => {
  if (!currentRoom.value) return false
  return currentRoom.value.players.length >= 2 &&
    currentRoom.value.players.every(player => player.ready)
})

const startGameMessage = computed(() => {
  if (!currentRoom.value) return ''
  if (currentRoom.value.players.length < 2) {
    return '최소 2명의 플레이어가 필요합니다'
  }
  if (!currentRoom.value.players.every(player => player.ready)) {
    return '모든 플레이어가 준비를 완료해야 합니다'
  }
  return ''
})

// Socket.IO 이벤트 핸들러 설정
const setupSocketListeners = () => {
  // 연결이 확인된 후에만 게임 목록 요청
  watch(isConnected, (connected) => {
    if (connected) {
      $socket.emit('getGames')
    }
  })

  $socket.on('connect', () => {
    console.log('Connected to WebSocket server')
    socketStatus.value = 'connected'
    $socket.emit('getGames')
  })

  $socket.on('gamesList', (gamesList) => {
    console.log('Received games list:', gamesList)
    games.value = gamesList
  })

  $socket.on('gameCreated', ({ roomId }) => {
    console.log('Game created, roomId:', roomId)
    currentRoom.value = {
      id: roomId,
      gameMode: gameMode.value,
      players: [{
        id: $socket.id,
        name: `Player_${Math.random().toString(36).substring(7)}`,
        ready: false
      }],
      owner: $socket.id
    }
    router.push(`/game/${roomId}`)
  })

  $socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error)
    socketStatus.value = 'error'
  })

  $socket.on('disconnect', () => {
    console.log('Disconnected from WebSocket server')
    socketStatus.value = 'disconnected'
  })

  $socket.on('roomJoined', (roomData) => {
    console.log('Joined room:', roomData)
    currentRoom.value = roomData
  })

  $socket.on('roomUpdated', (roomData) => {
    console.log('Room updated:', roomData)
    currentRoom.value = roomData
    // 내 준비 상태 동기화
    const myPlayer = roomData.players.find(p => p.id === $socket.id)
    if (myPlayer) {
      isReady.value = myPlayer.ready
    }
  })

  $socket.on('playerLeft', (roomData) => {
    console.log('Player left:', roomData)
    currentRoom.value = roomData
  })

  // $socket.on('gameStarted', () => {
  //   console.log('Game started')
  //   router.push(`/game/${currentRoom.value.id}`)
  // })

  $socket.on('error', ({ message }) => {
    console.error('Server error:', message)
    alert(message)
  })
}

const createGame = () => {
  console.log('Creating game with mode:', gameMode.value)
  $socket.emit('createGame', {
    gameMode: gameMode.value,
    maxPlayers: 4
  })
}

const joinGame = (gameId) => {
  console.log('Joining game:', gameId)
  const playerName = `Player_${Math.random().toString(36).substring(7)}`
  $socket.emit('joinRoom', {
    roomId: gameId,
    playerName: playerName
  })
  // 게임 페이지로 이동
  router.push(`/game/${gameId}`)
}

const handleJoinGame = (gameId) => {
  console.log('Joining game:', gameId)
  const playerName = `Player_${Math.random().toString(36).substring(7)}`
  $socket.emit('joinRoom', {
    roomId: gameId,
    playerName: playerName
  })
  router.push(`/game/${gameId}`)
}

const toggleReady = () => {
  isReady.value = !isReady.value
  $socket.emit('toggleReady', {
    roomId: currentRoom.value.id,
    ready: isReady.value
  })
}

const leaveRoom = () => {
  $socket.emit('leaveRoom', { roomId: currentRoom.value.id })
  currentRoom.value = null
  isReady.value = false
}

const startGame = () => {
  if (!canStartGame.value) return
  $socket.emit('startGame', { roomId: currentRoom.value.id })
}

// 주기적으로 게임 목록 업데이트
let gameListInterval
onMounted(() => {
  setupSocketListeners()
  gameListInterval = setInterval(() => {
    if (socketStatus.value === 'connected' && !currentRoom.value) {
      $socket.emit('getGames')
    }
  }, 5000)
})

onUnmounted(() => {
  if (gameListInterval) {
    clearInterval(gameListInterval)
  }
  [
    'connect', 'connect_error', 'disconnect',
    'gamesList', 'gameCreated', 'roomJoined', 'joinError',
    'roomUpdated', 'playerLeft', 'gameStarted', 'error'
  ].forEach(event => {
    $socket.off(event)
  })
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