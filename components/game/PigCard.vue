<!-- components/game/PigCard.vue -->
<template>
  <div
    class="pig-card"
    :class="{
      'dirty': pig.status === 'dirty',
      'beautiful': pig.status === 'beautiful',
      'has-barn': pig.barn,
      'has-lightning-rod': pig.lightningRod,
      'is-locked': pig.locked,
      'selectable': selectable,
      'selected': selected
    }"
    @click="handleClick"
  >
    <div class="pig-status">
      <span v-if="pig.barn" class="barn-icon">🏠</span>
      <span v-if="pig.lightningRod" class="lightning-rod-icon">⚡</span>
      <span v-if="pig.locked" class="lock-icon">🔒</span>
    </div>
    <div class="pig-image">
      <!-- 돼지 이미지나 아이콘 -->
      <span v-if="pig.status === 'dirty'">🐷</span>
      <span v-else-if="pig.status === 'beautiful'">👑🐷</span>
      <span v-else>🐽</span>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  pig: {
    type: Object,
    required: true
  },
  selectable: {
    type: Boolean,
    default: false
  },
  selected: {
    type: Boolean,
    default: false
  },
  isOpponent: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select'])

const handleClick = () => {
  if (props.selectable && !props.isOpponent) {
    emit('select', props.pig)
  }
}
</script>

<style scoped>
.pig-card {
  @apply w-24 h-36 border rounded-lg p-2 flex flex-col relative cursor-default;
}

.selectable {
  @apply cursor-pointer hover:ring-2 hover:ring-blue-400;
}

.selected {
  @apply ring-2 ring-blue-600;
}

.dirty {
  @apply bg-amber-100;  /* brown 대신 amber 사용 */
}

.beautiful {
  @apply bg-pink-100;
}

.has-barn {
  @apply bg-orange-50;  /* amber 대신 orange 사용 */
}

.pig-status {
  @apply absolute top-1 right-1 flex flex-col gap-1;
}

.pig-image {
  @apply flex-1 flex items-center justify-center text-3xl;
}
</style>