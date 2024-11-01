// composables/useGameStore.js
import { defineStore } from 'pinia'

export const useGameStore = defineStore('game', {
  state: () => ({
    // 게임 기본 정보
    roomId: null,
    gameMode: 'basic', // 'basic' | 'expansion'
    status: 'waiting', // 'waiting' | 'playing' | 'finished'

    // 플레이어 정보
    players: [],
    currentPlayerIndex: 0,
    localPlayerId: null,

    // 게임 진행 상태
    turnCount: 0,
    actionsRemaining: 1,
    lastAction: null,

    // 카드 관련
    deck: [],
    discardPile: [],

    // 게임 설정
    maxPlayers: 4,
    cardsPerHand: 3,
    pigsPerPlayer: 3,

    // 오류 및 메시지
    error: null,
    gameMessage: null
  }),

  getters: {
    // 현재 플레이어 관련
    currentPlayer: (state) => state.players[state.currentPlayerIndex],
    isCurrentPlayer: (state) => state.players[state.currentPlayerIndex]?.id === state.localPlayerId,
    localPlayer: (state) => state.players.find(p => p.id === state.localPlayerId),
    opponents: (state) => state.players.filter(p => p.id !== state.localPlayerId),

    // 게임 상태 관련
    canPlayCard: (state) => state.status === 'playing' && state.actionsRemaining > 0,
    isGameActive: (state) => state.status === 'playing',
    hasWinner: (state) => {
      return state.players.some(player => {
        if (state.gameMode === 'basic') {
          return player.pigs.every(pig => pig.status === 'dirty')
        } else {
          return player.pigs.every(pig => pig.status === 'dirty') ||
            player.pigs.every(pig => pig.status === 'beautiful')
        }
      })
    },

    // 덱 관련
    deckCount: (state) => state.deck.length,
    discardPileCount: (state) => state.discardPile.length
  },

  actions: {
    // 게임 초기화
    initializeGame(roomId, players, gameMode = 'basic') {
      this.roomId = roomId
      this.gameMode = gameMode
      this.status = 'playing'
      this.players = players.map(player => ({
        ...player,
        pigs: Array(this.pigsPerPlayer).fill().map(() => ({
          status: 'clean',
          barn: null
        })),
        hand: []
      }))

      this.deck = this.createDeck()
      this.shuffleDeck()
      this.dealInitialCards()
      this.currentPlayerIndex = 0
      this.turnCount = 0
      this.actionsRemaining = 1
    },

    // 덱 생성
    createDeck() {
      const basicCards = [
        ...Array(21).fill({ type: 'mud' }),
        ...Array(9).fill({ type: 'barn' }),
        ...Array(8).fill({ type: 'bath' }),
        ...Array(4).fill({ type: 'rain' }),
        ...Array(4).fill({ type: 'lightning' }),
        ...Array(4).fill({ type: 'lightning_rod' }),
        ...Array(4).fill({ type: 'barn_lock' })
      ]

      const expansionCards = this.gameMode === 'expansion' ? [
        ...Array(16).fill({ type: 'beautiful_pig' }),
        ...Array(12).fill({ type: 'escape' }),
        ...Array(4).fill({ type: 'lucky_bird' })
      ] : []

      return [...basicCards, ...expansionCards].map((card, index) => ({
        ...card,
        id: `${card.type}-${index}`
      }))
    },

    // 덱 셔플
    shuffleDeck() {
      for (let i = this.deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]]
      }
    },

    // 초기 카드 분배
    dealInitialCards() {
      this.players.forEach(player => {
        player.hand = this.deck.splice(0, this.cardsPerHand)
      })
    },

    // 카드 사용
    playCard({ playerId, cardId, targetId }) {
      if (!this.canPlayCard || playerId !== this.currentPlayer.id) {
        return { success: false, message: '카드를 사용할 수 없습니다.' }
      }

      const player = this.players.find(p => p.id === playerId)
      const cardIndex = player.hand.findIndex(card => card.id === cardId)

      if (cardIndex === -1) {
        return { success: false, message: '유효하지 않은 카드입니다.' }
      }

      const card = player.hand[cardIndex]
      const result = this.handleCardEffect(card, playerId, targetId)

      if (result.success) {
        // 카드 제거 및 새 카드 뽑기
        player.hand.splice(cardIndex, 1)
        this.discardPile.push(card)

        if (this.deck.length === 0) {
          this.reshuffleDeck()
        }

        player.hand.push(this.deck.pop())

        this.actionsRemaining--
        this.lastAction = {
          type: 'playCard',
          playerId,
          cardType: card.type,
          targetId
        }

        return result
      }

      return result
    },

    // 카드 효과 처리
    handleCardEffect(card, playerId, targetId) {
      const player = this.players.find(p => p.id === playerId)
      const target = targetId ? this.players.find(p => p.id === targetId) : null

      switch (card.type) {
        case 'mud':
          return this.handleMudCard(player)
        case 'barn':
          return this.handleBarnCard(player, targetId)
        case 'bath':
          return this.handleBathCard(player, target)
        case 'rain':
          return this.handleRainCard()
        case 'lightning':
          return this.handleLightningCard(target, targetId)
        case 'lightning_rod':
          return this.handleLightningRodCard(player, targetId)
        case 'barn_lock':
          return this.handleBarnLockCard(player, targetId)
        case 'beautiful_pig':
          return this.handleBeautifulPigCard(target, targetId)
        case 'escape':
          return this.handleEscapeCard(target, targetId)
        case 'lucky_bird':
          return this.handleLuckyBirdCard(player)
        default:
          return { success: false, message: '알 수 없는 카드 타입입니다.' }
      }
    },

    // 카드 효과별 처리 함수들
    handleMudCard(player) {
      const cleanPig = player.pigs.find(pig => pig.status === 'clean')
      if (!cleanPig) {
        return { success: false, message: '더럽힐 수 있는 깨끗한 돼지가 없습니다.' }
      }

      cleanPig.status = 'dirty'
      return {
        success: true,
        message: '드렉사우! 돼지가 더러워졌습니다!'
      }
    },

    handleBarnCard(player, pigIndex) {
      const pig = player.pigs[pigIndex]
      if (!pig || pig.barn) {
        return { success: false, message: '헛간을 지을 수 없습니다.' }
      }

      pig.barn = { hasLightningRod: false, isLocked: false }
      return {
        success: true,
        message: '헛간이 지어졌습니다.'
      }
    },

    // 나머지 카드 효과 처리 함수들 ...

    // 턴 관리
    endTurn() {
      if (this.actionsRemaining > 0) {
        return { success: false, message: '아직 행동을 할 수 있습니다.' }
      }

      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length
      this.turnCount++
      this.actionsRemaining = 1
      this.lastAction = null

      return { success: true }
    },

    // 게임 상태 업데이트 (웹소켓에서 받은 데이터 처리)
    updateGameState(newState) {
      Object.assign(this, newState)
    },

    // 덱 리셔플
    reshuffleDeck() {
      this.deck = [...this.discardPile]
      this.discardPile = []
      this.shuffleDeck()
    },

    // 승리 조건 체크
    checkWinCondition() {
      return this.players.find(player => {
        if (this.gameMode === 'basic') {
          return player.pigs.every(pig => pig.status === 'dirty')
        } else {
          return player.pigs.every(pig => pig.status === 'dirty') ||
            player.pigs.every(pig => pig.status === 'beautiful')
        }
      })
    },

    // 오류 처리
    setError(error) {
      this.error = error
      setTimeout(() => {
        this.error = null
      }, 3000)
    },

    // 게임 메시지 처리
    setGameMessage(message) {
      this.gameMessage = message
      setTimeout(() => {
        this.gameMessage = null
      }, 3000)
    }
  }
})