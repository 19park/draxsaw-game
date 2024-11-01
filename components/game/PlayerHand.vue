<!-- components/game/PlayerHand.vue -->
<template>
  <div class="player-hand">
    <div class="cards-container">
      <div
        v-for="(card, index) in cards"
        :key="card.id"
        class="card"
        :class="{
          'selected': selectedCard?.id === card.id,
          'playable': isCurrentTurn && canPlayCard(card)
        }"
        @click="handleCardClick(card)"
      >
        <div class="card-content">
          <div class="card-type">{{ getCardDisplayName(card.type) }}</div>
          <div class="card-icon">{{ getCardIcon(card.type) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>

import {useGameStore} from "~/composables/useGameStore.js";

const props = defineProps({
  cards: {
    type: Array,
    required: true
  },
  selectedCard: {
    type: Object,
    default: null
  },
  isCurrentTurn: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['selectCard'])

const gameStore = useGameStore()

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

const canPlayCard = (card) => {
  return gameStore.canPlayCard(card)
}

const handleCardClick = (card) => {
  if (!props.isCurrentTurn) return
  emit('selectCard', card)
}
</script>

<style scoped>
.player-hand {
  @apply w-full max-w-3xl mx-auto;
}

.cards-container {
  @apply flex flex-wrap justify-center gap-4;
}

.card {
  @apply w-24 h-36 border rounded-lg p-2 flex flex-col items-center justify-between
  cursor-pointer transition-all duration-200 bg-white shadow-sm;
}

.card.playable {
  @apply hover:shadow-md hover:-translate-y-1;
}

.card.selected {
  @apply ring-2 ring-blue-500 shadow-md -translate-y-2;
}

.card-content {
  @apply flex flex-col items-center gap-2;
}

.card-type {
  @apply text-sm font-medium text-center;
}

.card-icon {
  @apply text-2xl;
}

.disabled {
  @apply opacity-50 cursor-not-allowed;
}
</style>