<!-- components/game/GameControls.vue -->
<template>
  <div class="game-controls">
    <div class="status-info">
      <div class="turn-indicator" :class="{ 'active': isCurrentTurn }">
        {{ isCurrentTurn ? '당신의 턴입니다!' : '상대방 턴' }}
      </div>
      <div class="action-count">
        남은 행동: {{ remainingActions }}
      </div>
    </div>

    <div class="controls">
      <button
        class="control-button"
        :disabled="!isCurrentTurn || !selectedCard"
        @click="handlePlayCard"
      >
        카드 사용
      </button>

      <button
        class="control-button"
        :disabled="!isCurrentTurn || !selectedCard"
        @click="handleDiscardCard"
      >
        카드 버리기
      </button>

      <button
        class="control-button end-turn"
        :disabled="!isCurrentTurn || remainingActions > 0"
        @click="handleEndTurn"
      >
        턴 종료
      </button>
    </div>

    <div v-if="gameMessage" class="game-message" :class="messageType">
      {{ gameMessage }}
    </div>
  </div>
</template>

<script setup>
  import { ref, computed } from 'vue'
  import { useGameStore } from "~/composables/useGameStore"

  const props = defineProps({
    isCurrentTurn: {
      type: Boolean,
      required: true
    },
    selectedCard: {
      type: Object,
      default: null
    },
    canPlaySelected: {
      type: Boolean,
      default: false
    },
    canEndTurn: {
      type: Boolean,
      default: false
    },
    remainingActions: {
      type: Number,
      default: 0
    }
  })

  const emit = defineEmits(['playCard', 'discardCard', 'endTurn'])

  const gameStore = useGameStore()
  const gameMessage = ref('')
  const messageType = ref('info')

  const handlePlayCard = () => {
    if (!props.selectedCard || !props.isCurrentTurn) return

    console.log('Playing card:', props.selectedCard)
    emit('playCard', props.selectedCard)
  }

  const handleDiscardCard = () => {
    if (!props.selectedCard || !props.isCurrentTurn) return

    console.log('Discarding card:', props.selectedCard)
    emit('discardCard', props.selectedCard)
  }

  const handleEndTurn = () => {
    if (!props.isCurrentTurn || props.remainingActions > 0) return

    console.log('Ending turn')
    emit('endTurn')
  }

  const showMessage = (message, type = 'info') => {
    gameMessage.value = message
    messageType.value = type
    setTimeout(() => {
      gameMessage.value = ''
    }, 3000)
  }
</script>

<style scoped>
.game-controls {
  @apply fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg;
}

.status-info {
  @apply flex justify-between items-center mb-4;
}

.turn-indicator {
  @apply text-lg font-medium text-gray-600;
}

.turn-indicator.active {
  @apply text-green-600 font-bold;
}

.action-count {
  @apply text-sm text-gray-500;
}

.controls {
  @apply flex justify-center gap-4;
}

.control-button {
  @apply px-4 py-2 rounded-lg font-medium transition-colors
  disabled:opacity-50 disabled:cursor-not-allowed;
}

.control-button:not(:disabled) {
  @apply bg-blue-500 text-white hover:bg-blue-600;
}

.end-turn {
  @apply bg-green-500 hover:bg-green-600;
}

.game-message {
  @apply mt-4 text-center py-2 rounded-lg;
}

.game-message.info {
  @apply bg-blue-100 text-blue-800;
}

.game-message.success {
  @apply bg-green-100 text-green-800;
}

.game-message.error {
  @apply bg-red-100 text-red-800;
}
</style>