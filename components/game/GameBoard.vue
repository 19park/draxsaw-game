<!-- components/game/GameBoard.vue -->
<template>
  <div class="game-board">
    <!-- 상대방들의 영역 -->
    <div class="opponents-area">
      <div v-for="player in opponents"
           :key="player.id"
           :class="['opponent-section', { 'current-turn': isPlayerTurn(player.id) }]">
        <div class="player-info">
          <div class="player-header">
            <div class="player-name">{{ player.name }}</div>
            <div class="card-count">카드: {{ player.hand.length }}</div>
          </div>
          <!-- 돼지들 -->
          <div class="pigs-container">
            <div v-for="(pig, index) in player.pigs"
                 :key="index"
                 class="pig-card"
                 :class="getPigClasses(pig)">
              <PigCard
                :pig="pig"
                :selectable="canTargetPig(pig, player.id)"
                @select="handlePigSelect(pig, player.id)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 중앙 영역 (덱, 버린 카드 더미) -->
    <div class="center-area">
      <div class="deck-area">
        <div class="deck" @click="drawCard">
          <div class="card-back">
            <div class="card-count">{{ deckCount }}</div>
          </div>
        </div>
        <div class="discard-pile">
          <div v-if="lastDiscardedCard" class="card-front">
            {{ getCardDisplayName(lastDiscardedCard.type) }}
          </div>
        </div>
      </div>

      <!-- 현재 턴 표시 -->
      <div class="turn-indicator">
        {{ getTurnMessage() }}
      </div>
    </div>

    <!-- 플레이어 영역 -->
    <div class="player-area">
      <!-- 내 돼지들 -->
      <div class="my-pigs">
        <div v-for="(pig, index) in myPlayer.pigs"
             :key="index"
             class="pig-card"
             :class="getPigClasses(pig)">
          <PigCard
            :pig="pig"
            :is-mine="true"
            :selectable="canSelectOwnPig(pig)"
            @select="handlePigSelect(pig, myPlayer.id)"
          />
        </div>
      </div>

      <!-- 내 카드들 -->
      <div class="hand-container">
        <div v-for="(card, index) in myPlayer.hand"
             :key="card.id"
             :class="['card', {
               'selected': selectedCard?.id === card.id,
               'playable': canPlayCard(card)
             }]"
             @click="handleCardSelect(card)">
          <div class="card-content">
            <div class="card-type">{{ getCardDisplayName(card.type) }}</div>
            <div class="card-icon">{{ getCardIcon(card.type) }}</div>
          </div>
        </div>
      </div>

      <!-- 게임 컨트롤 -->
      <div class="game-controls">
        <button v-if="isMyTurn"
                class="play-button"
                :disabled="!canPlaySelected"
                @click="playSelectedCard">
          카드 사용
        </button>
        <button v-if="isMyTurn"
                class="discard-button"
                :disabled="!selectedCard"
                @click="discardSelectedCard">
          카드 버리기
        </button>
        <button v-if="isMyTurn"
                class="end-turn-button"
                :disabled="!canEndTurn"
                @click="endTurn">
          턴 종료
        </button>
      </div>
    </div>

    <!-- 게임 메시지 -->
    <div v-if="gameMessage"
         :class="['game-message', messageType]">
      {{ gameMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import PigCard from './PigCard.vue'

const props = defineProps({
  roomId: {
    type: String,
    required: true
  },
  currentPlayerId: {
    type: String,
    required: true
  },
  players: {
    type: Array,
    required: true
  },
  gameMode: {
    type: String,
    default: 'basic'
  }
})

const { $socket } = useNuxtApp()

// 상태 관리
const selectedCard = ref(null)
const selectedPig = ref(null)
const gameMessage = ref('')
const messageType = ref('info')
const lastDiscardedCard = ref(null)

// 게임 상태 계산
const myPlayer = computed(() => {
  return props.players.find(p => p.id === props.currentPlayerId) || {}
})

const opponents = computed(() => {
  return props.players.filter(p => p.id !== props.currentPlayerId)
})

const isMyTurn = computed(() => {
  return props.players[currentPlayerIndex.value]?.id === props.currentPlayerId
})

const currentPlayerIndex = ref(0)
const deckCount = ref(0)

// 카드 표시 관련
const cardDisplayNames = {
  mud: '진흙',
  barn: '헛간',
  bath: '목욕',
  rain: '비',
  lightning: '벼락',
  lightning_rod: '피뢰침',
  barn_lock: '헛간 잠금',
  beautiful_pig: '아름다운 돼지',
  escape: '도망',
  lucky_bird: '행운의 새'
}

const cardIcons = {
  mud: '💩',
  barn: '🏠',
  bath: '🛁',
  rain: '🌧️',
  lightning: '⚡',
  lightning_rod: '🗼',
  barn_lock: '🔒',
  beautiful_pig: '👑',
  escape: '🏃',
  lucky_bird: '🐦'
}

const getCardDisplayName = (type) => cardDisplayNames[type] || type
const getCardIcon = (type) => cardIcons[type] || '❓'

// 메서드
const showMessage = (message, type = 'info') => {
  gameMessage.value = message
  messageType.value = type
  setTimeout(() => {
    gameMessage.value = ''
  }, 3000)
}

const isPlayerTurn = (playerId) => {
  return props.players[currentPlayerIndex.value]?.id === playerId
}

const getTurnMessage = () => {
  if (isMyTurn.value) {
    return '내 턴입니다!'
  }
  const currentPlayer = props.players[currentPlayerIndex.value]
  return `${currentPlayer?.name}의 턴`
}

const handleCardSelect = (card) => {
  if (!isMyTurn.value) return

  if (selectedCard.value?.id === card.id) {
    selectedCard.value = null
    selectedPig.value = null
  } else {
    selectedCard.value = card
    selectedPig.value = null
  }
}

const handlePigSelect = (pig, playerId) => {
  if (!isMyTurn.value || !selectedCard.value) return

  if (canTargetPig(pig, playerId)) {
    selectedPig.value = { pig, playerId }
  }
}

const canPlayCard = (card) => {
  if (!isMyTurn.value) return false

  // 카드 타입별 사용 가능 조건 체크
  switch (card.type) {
    case 'mud':
      return myPlayer.value.pigs.some(pig => pig.status === 'clean')
    case 'bath':
      return opponents.value.some(player =>
        player.pigs.some(pig => pig.status === 'dirty' && !pig.barnLocked)
      )
    // ... 다른 카드 타입들에 대한 조건
    default:
      return true
  }
}

const canTargetPig = (pig, playerId) => {
  if (!selectedCard.value) return false

  // 카드 타입별 대상 선택 가능 조건 체크
  switch (selectedCard.value.type) {
    case 'bath':
      return pig.status === 'dirty' && !pig.barnLocked
    case 'mud':
      return playerId === props.currentPlayerId && pig.status === 'clean'
    // ... 다른 카드 타입들에 대한 조건
    default:
      return false
  }
}

const canSelectOwnPig = (pig) => {
  if (!selectedCard.value) return false
  return canTargetPig(pig, props.currentPlayerId)
}

const discardSelectedCard = () => {
  if (!selectedCard.value || !isMyTurn.value) return

  $socket.emit('discardCard', {
    roomId: props.roomId,
    cardId: selectedCard.value.id
  })
}

// script 부분에 추가
const getPigClasses = (pig) => {
  return {
    'pig-clean': pig.status === 'clean',
    'pig-dirty': pig.status === 'dirty',
    'pig-beautiful': pig.status === 'beautiful',
    'has-barn': pig.barn,
    'has-lightning-rod': pig.barn?.hasLightningRod,
    'is-locked': pig.barn?.isLocked,
    'is-selected': selectedPig.value?.pig.id === pig.id,
    'can-target': selectedCard.value && canTargetPig(pig, pig.playerId)
  }
}

// script 부분에 추가할 computed와 methods

// computed 속성 추가
const canPlaySelected = computed(() => {
  if (!selectedCard.value || !isMyTurn.value) return false

  // 대상이 필요한 카드인 경우, 대상이 선택되어 있어야 함
  if (needsTarget(selectedCard.value.type)) {
    return selectedPig.value !== null
  }

  // 대상이 필요없는 카드인 경우 바로 사용 가능
  return true
})

const canEndTurn = computed(() => {
  return isMyTurn.value && hasPlayedAction.value
})

const hasPlayedAction = ref(false)  // 턴에 액션을 수행했는지 여부

// methods 추가
const drawCard = () => {
  if (!isMyTurn.value || myPlayer.value.hand.length >= 3) return

  $socket.emit('drawCard', {
    roomId: props.roomId,
    playerId: props.currentPlayerId
  })
}

const needsTarget = (cardType) => {
  // 대상이 필요한 카드 타입들
  const targetNeededCards = [
    'mud', 'bath', 'barn', 'lightning',
    'lightning_rod', 'barn_lock', 'beautiful_pig'
  ]
  return targetNeededCards.includes(cardType)
}

// 기존 playSelectedCard 메서드 수정
const playSelectedCard = () => {
  if (!canPlaySelected.value) return

  $socket.emit('playCard', {
    roomId: props.roomId,
    cardId: selectedCard.value.id,
    targetPigId: selectedPig.value?.pig.id,
    targetPlayerId: selectedPig.value?.playerId
  })

  hasPlayedAction.value = true
  selectedCard.value = null
  selectedPig.value = null
}

// 기존 endTurn 메서드 수정
const endTurn = () => {
  if (!canEndTurn.value) return

  $socket.emit('endTurn', {
    roomId: props.roomId
  })

  // 턴 종료 시 상태 초기화
  hasPlayedAction.value = false
  selectedCard.value = null
  selectedPig.value = null
}

// 카드 관련 이벤트 리스너 추가 (onMounted 내부에 추가)
onMounted(() => {
  $socket.on('gameStateUpdated', (gameState) => {
    currentPlayerIndex.value = gameState.currentPlayerIndex
    deckCount.value = gameState.deck.length
    // 다른 게임 상태 업데이트...
  })

  $socket.on('cardPlayed', ({ playerId, card, target }) => {
    lastDiscardedCard.value = card
    // 카드 사용 효과 표시...
  })

  $socket.on('cardDrawn', (response) => {
    if (response.playerId === props.currentPlayerId) {
      // 카드를 뽑은 경우 처리
      showMessage('카드를 뽑았습니다.', 'info')
    }
  })

  $socket.on('turnStarted', () => {
    hasPlayedAction.value = false
    selectedCard.value = null
    selectedPig.value = null
  })

  $socket.on('turnEnded', () => {
    if (currentPlayerIndex.value === props.currentPlayerId) {
      showMessage('턴을 종료했습니다.', 'info')
    }
  })
})

// onUnmounted에 리스너 정리 추가
onUnmounted(() => {
  ['cardDrawn', 'turnStarted', 'turnEnded', 'gameStateUpdated', 'cardPlayed'].forEach(event => {
    $socket.off(event)
  })
})
</script>

<style scoped>
.game-board {
  @apply min-h-screen bg-gray-100 p-4 flex flex-col gap-8;
}

.opponents-area {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4;
}

.opponent-section {
  @apply bg-white rounded-lg p-4 shadow transition-colors duration-300;
}

.opponent-section.current-turn {
  @apply ring-2 ring-blue-500 bg-blue-50;
}

.player-info {
  @apply space-y-4;
}

.player-header {
  @apply flex justify-between items-center;
}

.player-name {
  @apply font-medium;
}

.card-count {
  @apply text-sm text-gray-600;
}

.pigs-container {
  @apply flex gap-2 flex-wrap;
}

.center-area {
  @apply flex flex-col items-center gap-4;
}

.deck-area {
  @apply flex gap-8;
}

.deck, .discard-pile {
  @apply w-32 h-48 rounded-lg shadow flex items-center justify-center;
}

.deck {
  @apply bg-blue-500 cursor-pointer hover:bg-blue-600 transition-colors;
}

.discard-pile {
  @apply bg-gray-100;
}

.turn-indicator {
  @apply text-lg font-medium text-center py-2;
}

.player-area {
  @apply space-y-4;
}

.my-pigs {
  @apply flex gap-2 justify-center flex-wrap;
}

.hand-container {
  @apply flex gap-2 justify-center flex-wrap;
}

.card {
  @apply w-32 h-48 bg-white rounded-lg shadow cursor-pointer
  hover:shadow-lg transition-all duration-200;
}

.card.selected {
  @apply ring-2 ring-blue-500 transform -translate-y-2;
}

.card.playable {
  @apply hover:bg-green-50;
}

.card-content {
  @apply h-full flex flex-col items-center justify-center p-2;
}

.card-type {
  @apply text-sm font-medium mb-2;
}

.card-icon {
  @apply text-3xl;
}

.game-controls {
  @apply flex justify-center gap-4;
}

.play-button, .discard-button, .end-turn-button {
  @apply px-4 py-2 rounded-lg font-medium transition-colors
  disabled:opacity-50 disabled:cursor-not-allowed;
}

.play-button {
  @apply bg-green-500 text-white hover:bg-green-600;
}

.discard-button {
  @apply bg-red-500 text-white hover:bg-red-600;
}

.end-turn-button {
  @apply bg-blue-500 text-white hover:bg-blue-600;
}

.game-message {
  @apply fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg;
}

.game-message.info {
  @apply bg-blue-100 text-blue-800;
}

.game-message.error {
  @apply bg-red-100 text-red-800;
}

.game-message.success {
  @apply bg-green-100 text-green-800;
}
/* style 부분에 추가 */
.pig-card {
  @apply relative w-24 h-36 rounded-lg transition-all duration-200;
}

.pig-clean {
  @apply bg-pink-50;
}

.pig-dirty {
  @apply bg-amber-100;
}

.pig-beautiful {
  @apply bg-purple-50 ring-2 ring-purple-300;
}

.has-barn {
  @apply bg-opacity-90;
}

.has-barn::after {
  content: '🏠';
  @apply absolute top-1 right-1 text-lg;
}

.has-lightning-rod::before {
  content: '⚡';
  @apply absolute top-1 left-1 text-lg;
}

.is-locked::after {
  content: '🔒';
  @apply absolute bottom-1 right-1 text-lg;
}

.is-selected {
  @apply ring-2 ring-blue-500 transform scale-105;
}

.can-target {
  @apply cursor-pointer hover:ring-2 hover:ring-green-500;
}

/* 헛간과 피뢰침이 모두 있는 경우를 위한 추가 스타일 */
.has-barn.has-lightning-rod::after {
  @apply right-6;
}

/* style 부분에 추가 */
.deck {
  @apply bg-blue-500 cursor-pointer hover:bg-blue-600 transition-colors
  relative flex items-center justify-center;
}

.deck:disabled {
  @apply opacity-50 cursor-not-allowed hover:bg-blue-500;
}

.deck .card-count {
  @apply absolute bottom-2 right-2 text-white font-medium
  bg-black bg-opacity-30 px-2 py-1 rounded;
}

.controls-container {
  @apply flex justify-center gap-4 mt-4;
}

.control-button {
  @apply px-4 py-2 rounded-lg transition-colors
  disabled:opacity-50 disabled:cursor-not-allowed;
}

.play-button {
  @apply bg-green-500 text-white hover:bg-green-600;
}

.end-turn-button {
  @apply bg-blue-500 text-white hover:bg-blue-600;
}

.card.disabled {
  @apply opacity-50 cursor-not-allowed;
}

.card.playable {
  @apply cursor-pointer hover:ring-2 hover:ring-green-500;
}
</style>