// composables/useGameStore.js
import { defineStore } from 'pinia'

export const useGameStore = defineStore('game', {
  state: () => ({
    // 게임 기본 정보
    roomId: null,
    gameMode: 'basic', // 'basic' | 'expansion'
    status: 'waiting', // 'waiting' | 'playing' | 'finished'
    currentRoom: null, // 현재 방 정보 추가

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

    // 게임 목록
    games: [], // 사용 가능한 게임 목록 추가

    // 오류 및 메시지
    error: null,
    gameMessage: null,

    // 준비 상태
    isReady: false,

    selectedCard: null,    // 선택된 카드
    selectedPig: null,     // 선택된 돼지
    handCount: {},        // 각 플레이어의 손패 수
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
    discardPileCount: (state) => state.discardPile.length,

    // 카드 사용 관련 getters 추가
    canPlaySelected: (state) => {
      if (!state.selectedCard || !state.isCurrentPlayer) return false
      return state.needsTarget(state.selectedCard.type) ?
        state.selectedPig !== null : true
    },

    needsTarget: () => (cardType) => {
      const targetNeededCards = [
        'mud', 'bath', 'barn', 'lightning',
        'lightning_rod', 'barn_lock', 'beautiful_pig'
      ]
      return targetNeededCards.includes(cardType)
    },
  },

  actions: {
    // 카드 선택 관련
    selectCard(card) {
      if (!this.isCurrentPlayer) return
      if (this.selectedCard?.id === card.id) {
        this.selectedCard = null
        this.selectedPig = null
      } else {
        this.selectedCard = card
        this.selectedPig = null
      }
    },

    selectPig(pig, playerId) {
      if (!this.isCurrentPlayer || !this.selectedCard) return
      if (this.canTargetPig(pig, playerId)) {
        this.selectedPig = { pig, playerId }
      }
    },

    // 카드 사용 가능 여부 체크
    canPlayCard(card) {
      if (!this.isCurrentPlayer) return false

      switch (card.type) {
        case 'mud':
          return this.localPlayer.pigs.some(pig => pig.status === 'clean')
        case 'bath':
          return this.opponents.some(player =>
            player.pigs.some(pig => pig.status === 'dirty' && !pig.barnLocked)
          )
        case 'barn':
          return this.localPlayer.pigs.some(pig => !pig.barn)
        case 'lightning':
          return this.opponents.some(player =>
            player.pigs.some(pig => pig.barn && !pig.barn.hasLightningRod)
          )
        case 'lightning_rod':
          return this.localPlayer.pigs.some(pig => pig.barn && !pig.barn.hasLightningRod)
        case 'barn_lock':
          return this.localPlayer.pigs.some(pig => pig.barn && !pig.barn.isLocked)
        case 'beautiful_pig':
          return this.localPlayer.pigs.some(pig => !pig.barn?.isLocked)
        case 'escape':
          return this.opponents.some(player =>
            player.pigs.some(pig => pig.status === 'beautiful')
          )
        case 'lucky_bird':
          return this.localPlayer.hand.length > 1
        case 'rain':
          return this.players.some(player =>
            player.pigs.some(pig => pig.status === 'dirty' && !pig.barn)
          )
        default:
          return true
      }
    },

    canTargetPig(pig, playerId) {
      if (!this.selectedCard) return false

      switch (this.selectedCard.type) {
        case 'mud':
          return playerId === this.localPlayerId && pig.status === 'clean'
        case 'bath':
          return pig.status === 'dirty' && !pig.barn?.isLocked
        case 'barn':
          return playerId === this.localPlayerId && !pig.barn
        case 'lightning':
          return pig.barn && !pig.barn.hasLightningRod
        case 'lightning_rod':
          return pig.barn && !pig.barn.hasLightningRod
        case 'barn_lock':
          return pig.barn && !pig.barn.isLocked
        case 'beautiful_pig':
          return !pig.barn?.isLocked
        case 'escape':
          return pig.status === 'beautiful'
        default:
          return false
      }
    },

    // 카드 효과 처리 함수들
    handleBathCard(player, target) {
      if (!target) return { success: false, message: '대상을 선택해야 합니다.' }
      const targetPig = target.pigs.find(pig => pig.status === 'dirty' && !pig.barn?.isLocked)
      if (!targetPig) return { success: false, message: '목욕시킬 수 없는 돼지입니다.' }

      targetPig.status = 'clean'
      return {
        success: true,
        message: '돼지가 깨끗해졌습니다!',
        effect: {
          type: 'STATUS_CHANGE',
          pigId: targetPig.id,
          playerId: target.id,
          from: 'dirty',
          to: 'clean'
        }
      }
    },

    handleRainCard() {
      let affected = []
      this.players.forEach(player => {
        player.pigs.forEach(pig => {
          if (pig.status === 'dirty' && !pig.barn) {
            pig.status = 'clean'
            affected.push({ playerId: player.id, pigId: pig.id })
          }
        })
      })

      if (affected.length === 0) {
        return { success: false, message: '비의 영향을 받을 수 있는 돼지가 없습니다.' }
      }

      return {
        success: true,
        message: '비가 내려 돼지들이 깨끗해졌습니다!',
        effect: {
          type: 'RAIN',
          affected
        }
      }
    },

    handleLightningCard(target, targetId) {
      if (!target || !targetId) return { success: false, message: '대상을 선택해야 합니다.' }
      const targetPig = target.pigs.find(pig => pig.barn && !pig.barn.hasLightningRod)
      if (!targetPig) return { success: false, message: '벼락을 맞출 수 없는 헛간입니다.' }

      delete targetPig.barn
      return {
        success: true,
        message: '벼락이 쳐서 헛간이 파괴되었습니다!',
        effect: {
          type: 'DESTROY_BARN',
          pigId: targetPig.id,
          playerId: targetId
        }
      }
    },

    handleLightningRodCard(player, targetId) {
      const targetPig = player.pigs.find(pig => pig.barn && !pig.barn.hasLightningRod)
      if (!targetPig) return { success: false, message: '피뢰침을 설치할 수 없는 헛간입니다.' }

      targetPig.barn.hasLightningRod = true
      return {
        success: true,
        message: '피뢰침이 설치되었습니다!',
        effect: {
          type: 'ADD_LIGHTNING_ROD',
          pigId: targetPig.id,
          playerId: targetId
        }
      }
    },

    handleBeautifulPigCard(target, targetId) {
      if (!target) return { success: false, message: '대상을 선택해야 합니다.' }
      const targetPig = target.pigs.find(pig => !pig.barn?.isLocked)
      if (!targetPig) return { success: false, message: '아름답게 만들 수 없는 돼지입니다.' }

      targetPig.status = 'beautiful'
      return {
        success: true,
        message: '돼지가 아름다워졌습니다!',
        effect: {
          type: 'STATUS_CHANGE',
          pigId: targetPig.id,
          playerId: targetId,
          from: targetPig.status,
          to: 'beautiful'
        }
      }
    },

    handleEscapeCard(target, targetId) {
      if (!target) return { success: false, message: '대상을 선택해야 합니다.' }
      const targetPig = target.pigs.find(pig => pig.status === 'beautiful')
      if (!targetPig) return { success: false, message: '도망갈 수 없는 돼지입니다.' }

      targetPig.status = 'clean'
      return {
        success: true,
        message: '아름다운 돼지가 도망갔습니다!',
        effect: {
          type: 'STATUS_CHANGE',
          pigId: targetPig.id,
          playerId: targetId,
          from: 'beautiful',
          to: 'clean'
        }
      }
    },

    setGamesList(games) {
      this.games = games
    },

    // 현재 방 설정
    setCurrentRoom(room) {
      this.currentRoom = room
      if (room) {
        this.roomId = room.id
        this.gameMode = room.gameMode
        this.players = room.players
        // 내 준비 상태 동기화
        const myPlayer = room.players.find(p => p.id === this.localPlayerId)
        if (myPlayer) {
          this.isReady = myPlayer.ready
        }
      } else {
        this.resetRoom()
      }
    },

    // 방 초기화
    resetRoom() {
      this.currentRoom = null
      this.roomId = null
      this.players = []
      this.isReady = false
    },

    // 방 상태 업데이트
    updateRoomState(state) {
      this.setCurrentRoom({
        ...this.currentRoom,
        ...state
      })
    },

    // 로컬 플레이어 ID 설정
    setLocalPlayerId(id) {
      this.localPlayerId = id
    },

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
      const result = this.handleCardEffect(card)

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
      // 기본 게임 상태 업데이트
      const { deck, discardPile, players, currentPlayerIndex, turnCount } = newState
      this.deck = deck
      this.discardPile = discardPile
      this.currentPlayerIndex = currentPlayerIndex
      this.turnCount = turnCount

      // 플레이어 상태 업데이트
      this.players = players.map(player => ({
        ...player,
        // 자신의 카드만 볼 수 있도록 처리
        hand: player.id === this.localPlayerId ? player.hand :
          Array(player.handCount).fill({ hidden: true })
      }))

      // 턴 체크
      if (this.isCurrentPlayer) {
        this.actionsRemaining = 1
      }
    },

    // 카드 뽑기 관련
    drawCard() {
      if (!this.canDrawCard) return false

      this.$socket.emit('drawCard', {
        roomId: this.roomId
      })
      return true
    },

    canDrawCard() {
      return this.isCurrentPlayer &&
        this.localPlayer.hand.length < this.cardsPerHand &&
        this.deck.length > 0
    },

    // 카드 버리기 관련
    discardCard(cardId) {
      if (!this.canDiscardCard) return false

      this.$socket.emit('discardCard', {
        roomId: this.roomId,
        cardId
      })
      return true
    },

    canDiscardCard() {
      return this.isCurrentPlayer && this.actionsRemaining > 0
    },

    // 턴 관리 확장
    startTurn() {
      this.actionsRemaining = 1
      this.selectedCard = null
      this.selectedPig = null
      this.lastAction = null
    },

    // endTurn() {
    //   if (!this.canEndTurn) return false
    //
    //   this.$socket.emit('endTurn', {
    //     roomId: this.roomId
    //   })
    //   return true
    // },

    canEndTurn() {
      return this.isCurrentPlayer && this.actionsRemaining === 0
    },

    // 게임 진행 상태 관리
    setGameStatus(status) {
      this.status = status
    },

    resetGameState() {
      this.selectedCard = null
      this.selectedPig = null
      this.actionsRemaining = 1
      this.lastAction = null
      this.deck = []
      this.discardPile = []
      this.players = []
      this.currentPlayerIndex = 0
      this.turnCount = 0
    },

    // 플레이어 상태 업데이트
    updatePlayerState(playerId, updates) {
      const playerIndex = this.players.findIndex(p => p.id === playerId)
      if (playerIndex !== -1) {
        this.players[playerIndex] = {
          ...this.players[playerIndex],
          ...updates
        }
      }
    },

    // 핸드 카운트 업데이트
    updateHandCount(playerId, count) {
      this.handCount[playerId] = count
    },

    // 에러 및 메시지 처리 확장
    showGameMessage(message, type = 'info') {
      this.gameMessage = { text: message, type }
      setTimeout(() => {
        this.gameMessage = null
      }, 3000)
    },

    // 유틸리티 메서드들
    findPig(pigId, playerId = null) {
      const player = playerId ?
        this.players.find(p => p.id === playerId) :
        this.currentPlayer
      return player?.pigs.find(p => p.id === pigId)
    },

    isValidTarget(pig, playerId) {
      if (!this.selectedCard) return false
      return this.canTargetPig(pig, playerId)
    },

    // 게임 종료 체크
    checkGameEnd() {
      const winner = this.players.find(player => {
        if (this.gameMode === 'basic') {
          return player.pigs.every(pig => pig.status === 'dirty')
        }
        return player.pigs.every(pig => pig.status === 'dirty') ||
          player.pigs.every(pig => pig.status === 'beautiful')
      })

      if (winner) {
        this.setGameStatus('finished')
        this.showGameMessage(`${winner.name}님이 승리했습니다!`, 'success')
        return true
      }
      return false
    },

    // Socket 이벤트 헬퍼
    emitGameAction(action, payload) {
      this.$socket.emit(action, {
        roomId: this.roomId,
        ...payload
      })
    },

    // 디버깅 헬퍼
    logGameState(message) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[GameStore] ${message}`, {
          currentPlayer: this.currentPlayer?.id,
          turnCount: this.turnCount,
          actionsRemaining: this.actionsRemaining,
          selectedCard: this.selectedCard?.type,
          selectedPig: this.selectedPig?.pig?.id
        })
      }
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
    },

    addToDiscardPile(card) {
      this.discardPile.push(card)
    },

    removeCardFromHand(cardId) {
      const index = this.localPlayer.hand.findIndex(card => card.id === cardId)
      if (index !== -1) {
        this.localPlayer.hand.splice(index, 1)
      }
    },

    updatePlayerHandCount(playerId, handCount) {
      const player = this.players.find(p => p.id === playerId)
      if (player) {
        if (handCount !== undefined) {
          player.handCount = handCount
        } else {
          player.handCount = player.handCount - 1
        }
      }
    },

    handleCardEffect(effect) {
      switch (effect.type) {
        case 'STATUS_CHANGE':
          this.handleStatusChange(effect)
          break
        case 'ADD_BARN':
          this.handleAddBarn(effect)
          break
        case 'DESTROY_BARN':
          this.handleDestroyBarn(effect)
          break
        case 'ADD_LIGHTNING_ROD':
          this.handleAddLightningRod(effect)
          break
        case 'LOCK_BARN':
          this.handleLockBarn(effect)
          break
        case 'RAIN':
          this.handleRainEffect(effect)
          break
        case 'LUCKY_BIRD':
          this.handleLuckyBird(effect)
          break
      }
    },

    handleStatusChange({ pigId, playerId, from, to }) {
      const player = this.players.find(p => p.id === playerId)
      if (player) {
        const pig = player.pigs.find(p => p.id === pigId)
        if (pig) {
          pig.status = to
        }
      }
    },

    handleAddBarn({ pigId, playerId }) {
      const player = this.players.find(p => p.id === playerId)
      if (player) {
        const pig = player.pigs.find(p => p.id === pigId)
        if (pig) {
          pig.barn = { hasLightningRod: false, isLocked: false }
        }
      }
    },

    handleDestroyBarn({ pigId, playerId }) {
      const player = this.players.find(p => p.id === playerId)
      if (player) {
        const pig = player.pigs.find(p => p.id === pigId)
        if (pig) {
          delete pig.barn
        }
      }
    },

    handleAddLightningRod({ pigId, playerId }) {
      const player = this.players.find(p => p.id === playerId)
      if (player) {
        const pig = player.pigs.find(p => p.id === pigId)
        if (pig?.barn) {
          pig.barn.hasLightningRod = true
        }
      }
    },

    handleLockBarn({ pigId, playerId }) {
      const player = this.players.find(p => p.id === playerId)
      if (player) {
        const pig = player.pigs.find(p => p.id === pigId)
        if (pig?.barn) {
          pig.barn.isLocked = true
        }
      }
    },

    handleRainEffect({ affectedPigs }) {
      affectedPigs.forEach(({ playerId, pigs }) => {
        const player = this.players.find(p => p.id === playerId)
        if (player) {
          pigs.forEach(({ pigId, wasAffected }) => {
            if (wasAffected) {
              const pig = player.pigs.find(p => p.id === pigId)
              if (pig?.status === 'dirty' && !pig.barn) {
                pig.status = 'clean'
              }
            }
          })
        }
      })
    },

    handleLuckyBird({ playerId }) {
      if (playerId === this.localPlayerId) {
        this.actionsRemaining = this.localPlayer.hand.length - 1
      }
    },

    startNewTurn(playerId, turnCount) {
      this.currentPlayerIndex = this.players.findIndex(p => p.id === playerId)
      this.turnCount = turnCount
      this.actionsRemaining = 1
      this.lastAction = null
    },

    endCurrentTurn() {
      this.actionsRemaining = 0
    }
  }
})