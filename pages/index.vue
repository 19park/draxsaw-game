<!-- pages/index.vue -->
<template>
  <div class="landing-page">
    <div class="hero">
      <h1 class="title">드렉사우 온라인</h1>
      <p class="subtitle">
        깨끗한 돼지들을 더럽게 만들어야 하는 보드게임을 온라인에서 즐겨보세요!
      </p>
      <div class="cta-buttons">
        <NuxtLink to="/lobby" class="play-button">
          게임 시작하기
        </NuxtLink>
        <button class="rules-button" @click="showRules = true">
          게임 규칙
        </button>
      </div>
    </div>

    <!-- 게임 규칙 모달 -->
    <div v-if="showRules" class="rules-modal">
      <div class="modal-content">
        <h2 class="modal-title">게임 규칙</h2>
        <div class="rules-content">
          <h3>게임 목표</h3>
          <p>자신의 돼지들을 가장 먼저 모두 더럽게 만들어야 합니다.</p>

          <h3>기본 규칙</h3>
          <ul>
            <li>각 플레이어는 3마리의 깨끗한 돼지로 시작합니다.</li>
            <li>매 턴마다 카드 1장을 사용하거나 버릴 수 있습니다.</li>
            <li>카드를 사용한 후에는 새로운 카드를 뽑아 3장을 유지합니다.</li>
          </ul>

          <h3>카드 종류</h3>
          <ul>
            <li>진흙 카드: 돼지를 더럽게 만듭니다</li>
            <li>헛간 카드: 비로부터 보호합니다</li>
            <li>목욕 카드: 다른 플레이어의 돼지를 깨끗하게 만듭니다</li>
            <li>비 카드: 모든 헛간 밖 돼지를 깨끗하게 만듭니다</li>
            <li>벼락 카드: 헛간을 파괴합니다</li>
            <li>피뢰침 카드: 헛간을 벼락으로부터 보호합니다</li>
            <li>헛간 잠금 카드: 목욕으로부터 보호합니다</li>
          </ul>
        </div>
        <button class="close-button" @click="showRules = false">
          닫기
        </button>
      </div>
    </div>

    <!-- 게임 특징 섹션 -->
    <div class="features">
      <div class="feature-card">
        <h3>실시간 멀티플레이</h3>
        <p>친구들과 함께 실시간으로 게임을 즐기세요</p>
      </div>
      <div class="feature-card">
        <h3>확장팩 지원</h3>
        <p>아름다운 돼지 확장팩으로 더 다양한 전략을</p>
      </div>
      <div class="feature-card">
        <h3>토너먼트 모드</h3>
        <p>여러 라운드를 통해 최종 승자를 가립니다</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const showRules = ref(false)
</script>

<style scoped>
.landing-page {
  @apply min-h-screen bg-gradient-to-b from-blue-50 to-white;
}

.hero {
  @apply max-w-4xl mx-auto pt-20 pb-16 px-4 text-center;
}

.title {
  @apply text-5xl font-bold text-blue-900 mb-6;
}

.subtitle {
  @apply text-xl text-gray-600 mb-12;
}

.cta-buttons {
  @apply flex justify-center gap-6;
}

.play-button {
  @apply px-8 py-3 bg-blue-600 text-white rounded-lg text-lg font-medium
  hover:bg-blue-700 transition-colors;
}

.rules-button {
  @apply px-8 py-3 bg-white text-blue-600 border border-blue-600 rounded-lg text-lg font-medium
  hover:bg-blue-50 transition-colors;
}

.rules-modal {
  @apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4;
}

.modal-content {
  @apply bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6;
}

.modal-title {
  @apply text-2xl font-bold mb-6;
}

.rules-content {
  @apply space-y-6;
}

.rules-content h3 {
  @apply text-lg font-semibold mb-2;
}

.rules-content ul {
  @apply list-disc pl-6 space-y-2;
}

.close-button {
  @apply mt-6 px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300
  transition-colors;
}

.features {
  @apply max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 px-4 py-16;
}

.feature-card {
  @apply bg-white p-6 rounded-xl shadow-sm text-center;
}

.feature-card h3 {
  @apply text-xl font-semibold mb-3;
}

.feature-card p {
  @apply text-gray-600;
}
</style>