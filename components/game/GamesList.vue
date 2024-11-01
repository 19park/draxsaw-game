<!-- components/game/GamesList.vue -->
<template>
  <div class="active-games">
    <h2 class="subtitle">진행 중인 게임</h2>
    <div v-if="games.length === 0" class="no-games">
      현재 진행 중인 게임이 없습니다
    </div>
    <div v-else class="games-list">
      <div v-for="game in games"
           :key="game.id"
           class="game-item">
        <div class="game-info">
          <div class="game-header">
            <span class="game-id">방 #{{ game.id }}</span>
            <span :class="['game-mode-badge', game.gameMode]">
              {{ game.gameMode === 'basic' ? '기본' : '확장팩' }}
            </span>
          </div>
          <div class="game-details">
            <span class="player-count">
              <span class="count-number">{{ game.playerCount }}/{{ game.maxPlayers }}</span>
              플레이어
            </span>
            <span class="status-indicator" :class="{ 'waiting': game.status === 'waiting' }">
              대기중
            </span>
          </div>
        </div>
        <button class="join-button"
                :disabled="game.playerCount >= game.maxPlayers"
                @click="handleJoin(game.id)">
          참여하기
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  games: {
    type: Array,
    required: true,
    default: () => []
  }
})

const emit = defineEmits(['join'])

const handleJoin = (gameId) => {
  emit('join', gameId)
}
</script>

<style scoped>
.active-games {
  @apply bg-white rounded-lg shadow-lg p-6;
}

.subtitle {
  @apply text-xl font-semibold mb-4;
}

.games-list {
  @apply space-y-4;
}

.game-item {
  @apply flex justify-between items-center p-4 bg-gray-50 rounded-lg
  hover:bg-gray-100 transition-colors duration-200;
}

.game-info {
  @apply flex flex-col gap-2;
}

.game-header {
  @apply flex items-center gap-3;
}

.game-id {
  @apply font-medium text-gray-900;
}

.game-mode-badge {
  @apply px-2 py-1 text-sm rounded-full;
}

.game-mode-badge.basic {
  @apply bg-blue-100 text-blue-800;
}

.game-mode-badge.expansion {
  @apply bg-purple-100 text-purple-800;
}

.game-details {
  @apply flex items-center gap-4 text-sm text-gray-600;
}

.player-count {
  @apply flex items-center gap-1;
}

.count-number {
  @apply font-medium text-gray-900;
}

.status-indicator {
  @apply flex items-center gap-1;
}

.status-indicator.waiting::before {
  content: "";
  @apply w-2 h-2 rounded-full bg-green-500;
}

.join-button {
  @apply px-4 py-2 bg-blue-500 text-white rounded-lg
  hover:bg-blue-600 transition-colors
  disabled:opacity-50 disabled:cursor-not-allowed;
}

.no-games {
  @apply text-center text-gray-500 py-8;
}
</style>