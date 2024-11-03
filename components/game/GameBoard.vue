<!-- components/game/GameBoard.vue -->
<template>
  <div class="game-board">
    <!-- 상대방들의 영역 -->
    <div class="opponents-area">
      <div
        v-for="player in gameStore.opponents"
        :key="player.id"
        :class="[
          'opponent-section',
          { 'current-turn': isPlayerTurn(player.id) }
        ]"
      >
        <div class="player-info">
          <div class="player-header">
            <div class="player-name">
              {{ player.name }}
              <span
                v-if="isPlayerTurn(player.id)"
                class="turn-indicator"
              >
                (턴 진행중)
              </span>
            </div>
            <div class="card-count">
              카드: {{ player.hand.length }}
            </div>
          </div>

          <!-- 돼지들 -->
          <div class="pigs-container">
            <div
              v-for="(pig, index) in player.pigs"
              :key="`${player.id}-pig-${index}`"
              class="pig-card"
              :class="[
                getPigClasses(pig),
                {
                  'selectable': canTargetPig(pig, player.id),
                  'selected': isSelectedPig(pig, player.id)
                }
              ]"
              @click="handlePigSelect(pig, player.id)"
            >
              <PigCard
                :pig="pig"
                :is-opponent="true"
                :selectable="canTargetPig(pig, player.id)"
                :selected="isSelectedPig(pig, player.id)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 중앙 영역 (덱, 버린 카드 더미) -->
    <div class="center-area">
      <div class="deck-area">
        <!-- 덱 -->
        <div
          class="deck"
          :class="{ 'clickable': canDrawCard }"
          @click="handleDrawCard"
        >
          <div class="card-back">
            <div class="card-count">{{ gameStore.deckCount }}</div>
          </div>
        </div>

        <!-- 버린 카드 더미 -->
        <div class="discard-pile">
          <div v-if="lastDiscardedCard" class="card-front">
            <div class="card-type">
              {{ getCardDisplayName(lastDiscardedCard.type) }}
            </div>
            <div class="card-icon">
              {{ getCardIcon(lastDiscardedCard.type) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 현재 턴 표시 -->
      <div
        class="turn-indicator"
        :class="{ 'my-turn': isMyTurn }"
      >
        {{ getTurnMessage() }}
      </div>

      <!-- 게임 메시지 -->
      <div
        v-if="gameMessage"
        :class="['game-message', messageType]"
      >
        {{ gameMessage }}
      </div>
    </div>

    <!-- 내 영역 -->
    <div class="player-area">
      <!-- 내 돼지들 -->
      <div class="my-pigs">
        <div
          v-for="(pig, index) in myPlayer.pigs"
          :key="`my-pig-${index}`"
          class="pig-card"
          :class="[
            getPigClasses(pig),
            {
              'selectable': canSelectOwnPig(pig),
              'selected': isSelectedPig(pig, myPlayer.id)
            }
          ]"
          @click="handlePigSelect(pig, myPlayer.id)"
        >
          <PigCard
            :pig="pig"
            :is-mine="true"
            :selectable="canSelectOwnPig(pig)"
            :selected="isSelectedPig(pig, myPlayer.id)"
          />
        </div>
      </div>

      <!-- 내 카드들 -->
      <div class="hand-container">
        <div
          v-for="card in myPlayer.hand"
          :key="card.id"
          :class="[
            'card',
            {
              'selected': isSelectedCard(card),
              'playable': canPlayCard(card),
              'disabled': !isMyTurn
            }
          ]"
          @click="handleCardSelect(card)"
        >
          <div class="card-content">
            <div class="card-type">
              {{ getCardDisplayName(card.type) }}
            </div>
            <div class="card-icon">
              {{ getCardIcon(card.type) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 게임 컨트롤 -->
      <GameControls
        :is-current-turn="isMyTurn"
        :selected-card="gameStore.gameState.selectedCard"
        :can-play-selected="canPlaySelected"
        :can-end-turn="canEndTurn"
        :remaining-actions="gameStore.gameState.actionsRemaining"
        @play-card="playSelectedCard"
        @discard-card="discardSelectedCard"
        @end-turn="endTurn"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useGameStore } from '~/composables/useGameStore'
import PigCard from './PigCard.vue'
import GameControls from './GameControls.vue'

// Props
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

// script setup 계속
const { $socket } = useNuxtApp()
const gameStore = useGameStore()

// 상태 관리
const selectedPig = ref(null)
const gameMessage = ref('')
const messageType = ref('info')
const lastDiscardedCard = ref(null)

// 카드 표시 설정
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

// Computed 속성
const myPlayer = computed(() => {
  console.log('Computing myPlayer:', {
    currentPlayerId: props.currentPlayerId,
    players: props.players.map(p => ({
      id: p.id,
      handCount: p.hand?.length
    }))
  })

  const player = props.players.find(p => p.id === props.currentPlayerId)
  if (!player) {
    console.warn('Current player not found in players array')
  }
  return player || { hand: [], pigs: [] }
})

// computed 속성 추가/수정
const isMyTurn = computed(() => {
  return gameStore.isCurrentPlayer
})

// canPlaySelected computed 속성 확인
const canPlaySelected = computed(() => {
  const selectedCard = gameStore.gameState.selectedCard
  const isCurrentTurn = gameStore.isCurrentPlayer
  const hasTarget = gameStore.needsTarget(selectedCard?.type) ? selectedPig.value !== null : true

  console.log('Can play selected check:', {
    selectedCard,
    isCurrentTurn,
    hasTarget,
    actionsRemaining: gameStore.gameState.actionsRemaining
  })

  return isCurrentTurn && selectedCard && hasTarget && gameStore.gameState.actionsRemaining > 0
})

const canEndTurn = computed(() => {
  return isMyTurn.value &&
    gameStore.gameState.actionsRemaining === 0
})

const canDrawCard = computed(() => {
  return isMyTurn.value &&
    myPlayer.value.hand?.length < gameStore.gameState.cardsPerHand &&
    gameStore.deckCount > 0
})

// Methods
const getCardDisplayName = (type) => cardDisplayNames[type] || type
const getCardIcon = (type) => cardIcons[type] || '❓'

const showMessage = (message, type = 'info') => {
  gameMessage.value = message
  messageType.value = type
  setTimeout(() => {
    gameMessage.value = ''
  }, 3000)
}

const isPlayerTurn = (playerId) => {
  const currentPlayer = props.players[gameStore.gameState.currentPlayerIndex]
  return currentPlayer?.id === playerId
}

const getTurnMessage = () => {
  if (isMyTurn.value) {
    return '내 턴입니다!'
  }
  const currentPlayer = props.players[gameStore.gameState.currentPlayerIndex]
  return `${currentPlayer?.name || '플레이어'}의 턴`
}

const handleCardSelect = (card) => {
  if (!isMyTurn.value) {
    showMessage('자신의 턴에만 카드를 선택할 수 있습니다.', 'error')
    return
  }

  console.log('Card selection:', {
    selectedCard: card,
    currentHand: myPlayer.value?.hand.map(c => ({
      id: c.id,
      type: c.type
    })),
    isInHand: myPlayer.value?.hand.some(c => c.id === card.id)
  })

  if (gameStore.gameState.selectedCard?.id === card.id) {
    gameStore.gameState.selectedCard = null
    selectedPig.value = null
  } else {
    // 손패에 있는 카드인지 한 번 더 확인
    const cardInHand = myPlayer.value?.hand.find(c => c.id === card.id)
    if (!cardInHand) {
      console.error('Attempting to select card not in hand')
      return
    }
    gameStore.gameState.selectedCard = cardInHand  // 손패에서 찾은 실제 카드 객체 사용
    selectedPig.value = null
  }
}

const handlePigSelect = (pig, playerId) => {
  if (!isMyTurn.value || !gameStore.gameState.selectedCard) {
    showMessage('카드를 선택한 후에만 돼지를 선택할 수 있습니다.', 'error')
    return
  }

  console.log('Selecting pig:', {
    pig,
    playerId,
    pigId: pig.id
  })

  if (canTargetPig(pig, playerId)) {
    selectedPig.value = {
      pig: {
        ...pig,
        id: pig.id  // ID가 제대로 전달되는지 확인
      },
      playerId
    }
  }
}

const canPlayCard = (card) => {
  if (!isMyTurn.value) return false
  return gameStore.canPlayCard(card);
}

const canTargetPig = (pig, playerId) => {
  if (!gameStore.gameState.selectedCard) return false
  return gameStore.canTargetPig(pig, playerId)
}

const canSelectOwnPig = (pig) => {
  if (!gameStore.gameState.selectedCard) return false
  return canTargetPig(pig, props.currentPlayerId)
}

const isSelectedCard = (card) => {
  return gameStore.gameState.selectedCard?.id === card.id
}

const isSelectedPig = (pig, playerId) => {
  return selectedPig.value?.pig.id === pig.id &&
    selectedPig.value?.playerId === playerId
}

const getPigClasses = (pig) => {
  return {
    'pig-clean': pig.status === 'clean',
    'pig-dirty': pig.status === 'dirty',
    'pig-beautiful': pig.status === 'beautiful',
    'has-barn': pig.barn,
    'has-lightning-rod': pig.barn?.hasLightningRod,
    'is-locked': pig.barn?.isLocked
  }
}

const handleDrawCard = async () => {
  if (!canDrawCard.value) {
    showMessage('카드를 뽑을 수 없습니다.', 'error')
    return
  }

  $socket.emit('drawCard', {
    roomId: props.roomId
  })
}

const playSelectedCard = async () => {
  if (!canPlaySelected.value) {
    showMessage('카드를 사용할 수 없습니다.', 'error')
    return
  }

  // 선택된 카드와 대상 정보 로깅
  console.log('Current game state:', {
    selectedCard: gameStore.gameState.selectedCard,
    playerHand: gameStore.localPlayer?.hand,
    selectedPig: selectedPig.value,
    localPlayerId: gameStore.gameState.localPlayerId
  })

  const cardData = {
    roomId: props.roomId,
    cardId: gameStore.gameState.selectedCard.id,
    targetPigId: selectedPig.value?.pig.id,
    targetPlayerId: selectedPig.value?.playerId,
    playerId: gameStore.gameState.localPlayerId  // playerId 추가
  }

  console.log('Sending card play data:', cardData)

  try {
    $socket.emit('playCard', cardData)
  } catch (error) {
    console.error('Error sending playCard event:', error)
    showMessage('카드 사용 중 오류가 발생했습니다.', 'error')
  }

  // 카드 선택 초기화는 성공 응답 후에 하도록 수정
  $socket.once('cardPlayed', () => {
    gameStore.gameState.selectedCard = null
    selectedPig.value = null
  })
}

const endTurn = async () => {
  if (!canEndTurn.value) {
    showMessage('아직 턴을 종료할 수 없습니다.', 'error')
    return
  }

  $socket.emit('endTurn', {
    roomId: props.roomId
  })
}

// GameBoard.vue
const discardSelectedCard = async () => {
  // 현재 손패와 선택된 카드 상태 확인
  const currentHand = myPlayer.value?.hand || []
  const selectedCard = gameStore.gameState.selectedCard

  console.log('Discard attempt:', {
    currentHand: currentHand.map(card => ({ id: card.id, type: card.type })),
    selectedCard,
    myPlayer: myPlayer.value,
    gameState: {
      localPlayerId: gameStore.gameState.localPlayerId,
      currentPlayerIndex: gameStore.gameState.currentPlayerIndex,
      players: gameStore.gameState.players.map(p => ({
        id: p.id,
        handCount: p.hand?.length,
        hand: p.hand
      }))
    }
  })

  if (!selectedCard || !isMyTurn.value) {
    showMessage('카드를 버릴 수 없습니다.', 'error')
    return
  }

  // 선택된 카드가 실제로 손패에 있는지 검증
  const cardInHand = currentHand.find(card => card.id === selectedCard.id)
  if (!cardInHand) {
    console.error('Selected card not in hand:', {
      selectedCardId: selectedCard.id,
      handCardIds: currentHand.map(c => c.id)
    })
    showMessage('선택한 카드가 손패에 없습니다.', 'error')
    return
  }

  const cardData = {
    roomId: props.roomId,
    cardId: cardInHand.id,  // 손패에서 찾은 카드의 ID 사용
    playerId: gameStore.gameState.localPlayerId
  }

  console.log('Emitting discard card:', cardData)
  $socket.emit('discardCard', cardData)
}

// Socket 이벤트 리스너
onMounted(() => {
  $socket.on('cardPlayed', ({ playerId, card, effect }) => {
    if (effect) {
      gameStore.handleCardEffect(effect)
    }
    lastDiscardedCard.value = card
  })

  $socket.on('cardDrawn', ({ playerId }) => {
    if (playerId === props.currentPlayerId) {
      showMessage('카드를 뽑았습니다.', 'success')
    }
  })

  $socket.on('cardDiscarded', ({ playerId, card }) => {
    lastDiscardedCard.value = card
  })

  $socket.on('turnStarted', () => {
    gameStore.gameState.selectedCard = null
    selectedPig.value = null
  })
})

onUnmounted(() => {
  ['cardPlayed', 'cardDrawn', 'cardDiscarded', 'turnStarted'].forEach(event => {
    $socket.off(event)
  })
})

// GameBoard.vue에 디버깅 로그 추가
console.log('Current game state:', gameStore.gameState)
console.log('Selected card:', gameStore.gameState.selectedCard)
console.log('Selected pig:', selectedPig.value)
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
  @apply font-medium flex items-center gap-2;
}

.turn-indicator {
  @apply text-sm text-blue-600 font-medium;
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
  @apply bg-blue-500 transition-colors relative;
}

.deck.clickable {
  @apply cursor-pointer hover:bg-blue-600;
}

.card-back {
  @apply text-white text-center;
}

.discard-pile {
  @apply bg-gray-100;
}

.card-front {
  @apply flex flex-col items-center justify-center gap-2;
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

.card.disabled {
  @apply opacity-50 cursor-not-allowed;
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

.game-message {
  @apply fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-sm;
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

.pig-card {
  @apply relative w-24 h-36 rounded-lg transition-all duration-200;
}

.pig-card.selectable {
  @apply cursor-pointer hover:ring-2 hover:ring-green-500;
}

.pig-card.selected {
  @apply ring-2 ring-blue-500 transform scale-105;
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

.has-barn:after {
  content: '🏠';
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  font-size: 1.125rem;
}

.has-lightning-rod:before {
  content: '⚡';
  position: absolute;
  top: 0.25rem;
  left: 0.25rem;
  font-size: 1.125rem;
}

.is-locked:after {
  content: '🔒';
  position: absolute;
  bottom: 0.25rem;
  right: 0.25rem;
  font-size: 1.125rem;
}
</style>