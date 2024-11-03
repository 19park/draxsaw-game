// 1. State와 Getters 부분
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useGameStore = defineStore('game', () => {
  // State
  const gameState = ref({
    // 게임 기본 정보
    roomId: null,
    gameMode: 'basic',
    status: 'waiting',
    currentRoom: null,

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
    selectedCard: null,
    selectedPig: null,
    handCount: {},

    // 게임 설정
    maxPlayers: 4,
    cardsPerHand: 3,
    pigsPerPlayer: 3,

    // 게임 목록
    games: [],
    roomState: {
      players: [],
      gameMode: 'basic',
      maxPlayers: 4,
      owner: null,
      status: 'waiting'
    },

    // 오류 및 메시지
    error: null,
    gameMessage: null,

    // 준비 상태
    isReady: false
  })

  // Getters
  const currentPlayer = computed(() => {
    const players = gameState.value.players
    return players[gameState.value.currentPlayerIndex] || null
  })

  const isCurrentPlayer = computed(() => {
    const currentPlayer = gameState.value.players[gameState.value.currentPlayerIndex]
    return currentPlayer?.id === gameState.value.localPlayerId
  })

  const localPlayer = computed(() => {
    console.log('Computing local player:', {
      localPlayerId: gameState.value.localPlayerId,
      players: gameState.value.players,
      playerIds: gameState.value.players.map(p => p.id)
    })

    if (!gameState.value.localPlayerId || !gameState.value.players) {
      console.warn('Missing required data:', {
        localPlayerId: gameState.value.localPlayerId,
        hasPlayers: Boolean(gameState.value.players)
      })
      return null
    }

    const player = gameState.value.players.find(p => p.id === gameState.value.localPlayerId)
    console.log('Found local player:', player)
    return player
  })

  const opponents = computed(() =>
    gameState.value.players.filter(p => p.id !== gameState.value.localPlayerId)
  )

  // const canPlayCard = computed(() =>
  //   gameState.value.status === 'playing' && gameState.value.actionsRemaining > 0
  // )

  const isGameActive = computed(() => gameState.value.status === 'playing')

  const hasWinner = computed(() => {
    return gameState.value.players.some(player => {
      if (gameState.value.gameMode === 'basic') {
        return player.pigs?.every(pig => pig.status === 'dirty')
      }
      return player.pigs?.every(pig => pig.status === 'dirty') ||
        player.pigs?.every(pig => pig.status === 'beautiful')
    })
  })

  const deckCount = computed(() => gameState.value.deck.length)
  const discardPileCount = computed(() => gameState.value.discardPile.length)

  // 게임 목록 관련 getter 추가
  const games = computed(() => gameState.value.games)
  const currentRoom = computed(() => gameState.value.currentRoom)
  const roomState = computed(() => gameState.value.roomState)
  const roomPlayers = computed(() => gameState.value.players)
  const isRoomOwner = computed(() => gameState.value.owner === gameState.value.localPlayerId)

  const canStartGame = computed(() => {
    const { players, status } = gameState.value
    return status === 'waiting' &&
      players.length >= 2 &&
      players.every(p => p.ready)
  })

  const canPlaySelected = computed(() => {
    const { selectedCard } = gameState.value
    if (!selectedCard || !isCurrentPlayer.value) return false

    return needsTarget(selectedCard.type) ?
      gameState.value.selectedPig !== null : true
  })

  function leaveRoom() {
    resetRoom()
  }

  // 게임 목록 관련 메서드
  function updateGames(games) {
    console.log('Updating games in store:', games)
    if (!Array.isArray(games)) return

    const currentState = { ...gameState.value }

    gameState.value = {
      ...currentState,
      games: games.map(game => ({
        ...game,
        players: game.players || [],
        status: game.status || 'waiting'
      }))
    }

    console.log('Updated games list:', gameState.value.games)
  }

  function addGame(game) {
    if (!game || !game.id) return

    const currentGames = [...gameState.value.games]
    const existingIndex = currentGames.findIndex(g => g.id === game.id)

    if (existingIndex >= 0) {
      currentGames[existingIndex] = {
        ...currentGames[existingIndex],
        ...game,
        players: game.players || [],
        status: game.status || 'waiting'
      }
    } else {
      currentGames.push({
        ...game,
        players: game.players || [],
        status: game.status || 'waiting'
      })
    }

    gameState.value = {
      ...gameState.value,
      games: currentGames
    }
  }

  function syncGames(games) {
    if (!Array.isArray(games)) return

    const currentGames = gameState.value.games
    const newGames = games.filter(game => !currentGames.some(g => g.id === game.id))
    const removedGames = currentGames.filter(game => !games.some(g => g.id === game.id))

    if (newGames.length > 0 || removedGames.length > 0) {
      updateGames(games)
    }
  }

  function removeGame(gameId) {
    if (!gameId) return

    gameState.value = {
      ...gameState.value,
      games: gameState.value.games.filter(game => game.id !== gameId)
    }
  }

  function updateGameInList(gameId, updates) {
    const gameIndex = gameState.value.games.findIndex(g => g.id === gameId)
    if (gameIndex === -1) return

    const updatedGames = [...gameState.value.games]
    updatedGames[gameIndex] = {
      ...updatedGames[gameIndex],
      ...updates
    }

    gameState.value = {
      ...gameState.value,
      games: updatedGames
    }
  }

  // 방 관련 메서드
  function setLocalPlayerId(id) {
    console.log('Setting local player ID:', {
      current: gameState.value.localPlayerId,
      new: id
    })

    gameState.value = {
      ...gameState.value,
      localPlayerId: id
    }

    console.log('Local player ID set:', {
      localPlayerId: gameState.value.localPlayerId,
      localPlayer: localPlayer.value
    })
  }

  function setCurrentRoom(room) {
    if (!room) {
      resetRoom()
      return
    }

    gameState.value = {
      ...gameState.value,
      currentRoom: room,
      roomId: room.id,
      gameMode: room.gameMode,
      players: room.players
    }

    const myPlayer = room.players.find(p => p.id === gameState.value.localPlayerId)
    if (myPlayer) {
      gameState.value.isReady = myPlayer.ready
    }
  }

  function resetRoom() {
    const initialState = {
      currentRoom: null,
      roomId: null,
      players: [],
      isReady: false,
      selectedCard: null,
      selectedPig: null,
      deck: [],
      discardPile: [],
      turnCount: 0,
      actionsRemaining: 1,
      lastAction: null
    }

    gameState.value = {
      ...gameState.value,
      ...initialState
    }
  }

  function updateRoomState(state) {
    if (!state) return

    const updatedState = { ...gameState.value }

    if (state.id) updatedState.roomId = state.id
    if (state.gameMode) updatedState.gameMode = state.gameMode
    if (state.status) updatedState.status = state.status
    if (state.maxPlayers) updatedState.maxPlayers = state.maxPlayers
    if (state.owner) updatedState.owner = state.owner

    if (state.players) {
      updatedState.players = state.players.map(player => ({
        ...player,
        hand: player.id === updatedState.localPlayerId ?
          player.hand : Array(player.handCount || 0).fill({ hidden: true })
      }))

      const myPlayer = state.players.find(p => p.id === updatedState.localPlayerId)
      if (myPlayer) {
        updatedState.isReady = myPlayer.ready
      }
    }

    if (state.currentRoom) {
      updatedState.currentRoom = state.currentRoom
    }

    updatedState.roomState = {
      ...updatedState.roomState,
      players: updatedState.players,
      gameMode: updatedState.gameMode,
      maxPlayers: updatedState.maxPlayers,
      owner: updatedState.owner,
      status: updatedState.status
    }

    gameState.value = updatedState
  }

  // 게임 진행 관련 메서드
  function initializeGame(roomId, players, gameMode = 'basic') {
    console.log('Initializing game:', {
      roomId,
      players: players.map(p => ({
        id: p.id,
        handCount: p.hand?.length,
        cards: p.hand?.map(card => ({id: card.id, type: card.type}))
      })),
      gameMode
    })

    gameState.value = {
      ...gameState.value,
      roomId,
      gameMode,
      status: 'playing',
      players: players.map(player => ({
        ...player,
        pigs: Array(gameState.value.pigsPerPlayer).fill().map(() => ({
          id: `${player.id}-pig-${Math.random().toString(36).substr(2, 9)}`,
          status: 'clean',
          barn: null
        })),
        hand: player.id === gameState.value.localPlayerId ?
          player.hand :
          Array(player.hand?.length || 0).fill({ hidden: true })
      })),
      deck: [],
      discardPile: [],
      currentPlayerIndex: 0,
      turnCount: 0,
      actionsRemaining: 1
    }

    console.log('Game initialized:', {
      localPlayerId: gameState.value.localPlayerId,
      players: gameState.value.players.map(p => ({
        id: p.id,
        handCount: p.hand?.length,
        isLocal: p.id === gameState.value.localPlayerId,
        cards: p.id === gameState.value.localPlayerId ?
          p.hand?.map(card => ({id: card.id, type: card.type})) :
          'hidden'
      }))
    })
  }

  function createDeck() {
    const basicCards = [
      ...Array(21).fill().map((_, i) => ({ id: `mud-${i}`, type: 'mud' })),
      ...Array(9).fill().map((_, i) => ({ id: `barn-${i}`, type: 'barn' })),
      ...Array(8).fill().map((_, i) => ({ id: `bath-${i}`, type: 'bath' })),
      ...Array(4).fill().map((_, i) => ({ id: `rain-${i}`, type: 'rain' })),
      ...Array(4).fill().map((_, i) => ({ id: `lightning-${i}`, type: 'lightning' })),
      ...Array(4).fill().map((_, i) => ({ id: `lightning_rod-${i}`, type: 'lightning_rod' })),
      ...Array(4).fill().map((_, i) => ({ id: `barn_lock-${i}`, type: 'barn_lock' }))
    ]

    if (gameState.value.gameMode === 'expansion') {
      const expansionCards = [
        ...Array(16).fill().map((_, i) => ({ id: `beautiful_pig-${i}`, type: 'beautiful_pig' })),
        ...Array(12).fill().map((_, i) => ({ id: `escape-${i}`, type: 'escape' })),
        ...Array(4).fill().map((_, i) => ({ id: `lucky_bird-${i}`, type: 'lucky_bird' }))
      ]
      return [...basicCards, ...expansionCards]
    }

    return basicCards
  }

  function shuffleDeck() {
    const deck = [...gameState.value.deck]
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]]
    }
    gameState.value.deck = deck
  }

  function dealInitialCards() {
    const updatedPlayers = gameState.value.players.map(player => ({
      ...player,
      hand: gameState.value.deck.splice(0, gameState.value.cardsPerHand)
    }))
    gameState.value.players = updatedPlayers
  }

  function drawCard() {
    if (!localPlayer.value || localPlayer.value.hand.length >= gameState.value.cardsPerHand) {
      return false
    }

    if (gameState.value.deck.length === 0) {
      if (gameState.value.discardPile.length === 0) return false

      gameState.value.deck = [...gameState.value.discardPile]
      gameState.value.discardPile = []
      shuffleDeck()
    }

    const drawnCard = gameState.value.deck.pop()
    if (drawnCard) {
      const updatedPlayers = [...gameState.value.players]
      const playerIndex = updatedPlayers.findIndex(p => p.id === gameState.value.localPlayerId)
      if (playerIndex !== -1) {
        updatedPlayers[playerIndex] = {
          ...updatedPlayers[playerIndex],
          hand: [...updatedPlayers[playerIndex].hand, drawnCard]
        }
        gameState.value.players = updatedPlayers
        return true
      }
    }
    return false
  }

  function discardCard(cardId) {
    console.log('Attempting to discard card:', {
      cardId,
      localPlayer: localPlayer.value,
      localPlayerId: gameState.value.localPlayerId
    })

    const player = localPlayer.value
    if (!player) {
      console.error('Local player not found')
      return false
    }

    const cardIndex = player.hand.findIndex(card => card.id === cardId)
    if (cardIndex === -1) {
      console.error('Card not found in hand')
      return false
    }

    const updatedPlayers = [...gameState.value.players]
    const playerIndex = updatedPlayers.findIndex(p => p.id === gameState.value.localPlayerId)

    const card = player.hand[cardIndex]
    updatedPlayers[playerIndex] = {
      ...updatedPlayers[playerIndex],
      hand: [
        ...updatedPlayers[playerIndex].hand.slice(0, cardIndex),
        ...updatedPlayers[playerIndex].hand.slice(cardIndex + 1)
      ]
    }

    gameState.value = {
      ...gameState.value,
      players: updatedPlayers,
      discardPile: [...gameState.value.discardPile, card]
    }

    return true
  }

  function handleCardEffect(effect) {
    console.log('Handling card effect:', effect)
    if (!effect) return

    switch (effect.type) {
      case 'STATUS_CHANGE':
        console.log('Handling status change:', effect)
        handleStatusChange(effect)
        break
      case 'ADD_BARN':
        handleAddBarn(effect)
        break
      case 'DESTROY_BARN':
        handleDestroyBarn(effect)
        break
      case 'ADD_LIGHTNING_ROD':
        handleAddLightningRod(effect)
        break
      case 'LOCK_BARN':
        handleLockBarn(effect)
        break
      case 'RAIN':
        handleRainEffect(effect)
        break
      case 'LUCKY_BIRD':
        handleLuckyBird(effect)
        break
    }
  }
  function handleDiscardCard({ playerId, card }) {
    console.log('Handling discard card:', { playerId, card })

    const currentState = { ...gameState.value }

    // 플레이어 핸드에서 카드 제거
    if (playerId === currentState.localPlayerId) {
      const playerIndex = currentState.players.findIndex(p => p.id === playerId)
      if (playerIndex !== -1) {
        const player = currentState.players[playerIndex]
        const cardIndex = player.hand.findIndex(c => c.id === card.id)
        if (cardIndex !== -1) {
          player.hand.splice(cardIndex, 1)
        }
      }
    }

    // 버린 카드 더미에 추가
    currentState.discardPile.push(card)

    gameState.value = currentState
  }

  // 카드 효과 처리 함수들
  function handleStatusChange({ pigId, playerId, to }) {
    updatePlayerPig(playerId, pigId, pig => ({ ...pig, status: to }))
  }

  function handleAddBarn({ pigId, playerId }) {
    updatePlayerPig(playerId, pigId, pig => ({
      ...pig,
      barn: { hasLightningRod: false, isLocked: false }
    }))
  }

  function handleDestroyBarn({ pigId, playerId }) {
    updatePlayerPig(playerId, pigId, pig => ({ ...pig, barn: null }))
  }

  function handleAddLightningRod({ pigId, playerId }) {
    updatePlayerPig(playerId, pigId, pig => ({
      ...pig,
      barn: pig.barn ? { ...pig.barn, hasLightningRod: true } : null
    }))
  }

  function handleLockBarn({ pigId, playerId }) {
    updatePlayerPig(playerId, pigId, pig => ({
      ...pig,
      barn: pig.barn ? { ...pig.barn, isLocked: true } : null
    }))
  }

  function handleRainEffect({ affectedPigs }) {
    const updatedPlayers = [...gameState.value.players]

    affectedPigs.forEach(({ playerId, pigs }) => {
      const playerIndex = updatedPlayers.findIndex(p => p.id === playerId)
      if (playerIndex === -1) return

      pigs.forEach(({ pigId, wasAffected }) => {
        if (!wasAffected) return

        const pig = updatedPlayers[playerIndex].pigs.find(p => p.id === pigId)
        if (pig?.status === 'dirty' && !pig.barn) {
          pig.status = 'clean'
        }
      })
    })

    gameState.value.players = updatedPlayers
  }

  function handleLuckyBird({ playerId }) {
    if (playerId === gameState.value.localPlayerId) {
      gameState.value.actionsRemaining = localPlayer.value?.hand.length - 1 || 0
    }
  }

  // 유틸리티 함수
  function updatePlayerPig(playerId, pigId, updateFn) {
    const players = [...gameState.value.players]
    const playerIndex = players.findIndex(p => p.id === playerId)
    if (playerIndex === -1) return

    const pigIndex = players[playerIndex].pigs.findIndex(p => p.id === pigId)
    if (pigIndex === -1) return

    players[playerIndex] = {
      ...players[playerIndex],
      pigs: [
        ...players[playerIndex].pigs.slice(0, pigIndex),
        updateFn(players[playerIndex].pigs[pigIndex]),
        ...players[playerIndex].pigs.slice(pigIndex + 1)
      ]
    }

    gameState.value.players = players
  }

  function checkWinCondition() {
    return gameState.value.players.find(player => {
      if (gameState.value.gameMode === 'basic') {
        return player.pigs.every(pig => pig.status === 'dirty')
      }
      return player.pigs.every(pig => pig.status === 'dirty') ||
        player.pigs.every(pig => pig.status === 'beautiful')
    })
  }

  function setGameStatus(status) {
    gameState.value.status = status
  }

  function showGameMessage(message, type = 'info') {
    gameState.value.gameMessage = { text: message, type }
    setTimeout(() => {
      gameState.value.gameMessage = null
    }, 3000)
  }

  function setError(error) {
    gameState.value.error = error
    setTimeout(() => {
      gameState.value.error = null
    }, 3000)
  }

  // 카드 사용 가능 여부 체크
  function canPlayCard(card) {
    if (!isCurrentPlayer.value) return false

    switch (card.type) {
      case 'mud':
        return localPlayer.value.pigs.some(pig => pig.status === 'clean')
      case 'bath':
        return opponents.value.some(player =>
          player.pigs.some(pig => pig.status === 'dirty' && !pig.barnLocked)
        )
      case 'barn':
        return localPlayer.value.pigs.some(pig => !pig.barn)
      case 'lightning':
        return opponents.value.some(player =>
          player.pigs.some(pig => pig.barn && !pig.barn.hasLightningRod)
        )
      case 'lightning_rod':
        return localPlayer.value.pigs.some(pig => pig.barn && !pig.barn.hasLightningRod)
      case 'barn_lock':
        return localPlayer.value.pigs.some(pig => pig.barn && !pig.barn.isLocked)
      case 'beautiful_pig':
        return localPlayer.value.pigs.some(pig => !pig.barn?.isLocked)
      case 'escape':
        return opponents.value.some(player =>
          player.pigs.some(pig => pig.status === 'beautiful')
        )
      case 'lucky_bird':
        return localPlayer.value.hand.length > 1
      case 'rain':
        const players = [...gameState.value.players]
        return players.some(player =>
          player.pigs.some(pig => pig.status === 'dirty' && !pig.barn)
        )
      default:
        return true
    }
  }

  function canTargetPig(pig, playerId) {
    const { selectedCard, localPlayerId } = gameState.value
    if (!selectedCard) return false
    switch (selectedCard.type) {
      case 'mud':
        return playerId === localPlayerId && pig.status === 'clean'
      case 'bath':
        return pig.status === 'dirty' && !pig.barn?.isLocked
      case 'barn':
        return playerId === localPlayerId && !pig.barn
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
  }

  // 누락된 메서드들 추가
  function updateGameState(newState) {
    console.log('Updating game state:', {
      currentState: {
        localPlayerId: gameState.value.localPlayerId,
        actionsRemaining: gameState.value.actionsRemaining,
        players: gameState.value.players?.map(p => ({
          id: p.id,
          handCount: p.hand?.length
        }))
      },
      newState: {
        actionsRemaining: newState.actionsRemaining,
        players: newState.players?.map(p => ({
          id: p.id,
          handCount: p.hand?.length
        }))
      }
    })

    if (!newState) return

    const updatedState = { ...gameState.value }

    // players 업데이트 시 localPlayer의 hand 보존
    if (newState.players) {
      updatedState.players = newState.players.map(player => {
        const isLocalPlayer = player.id === gameState.value.localPlayerId

        // 로컬 플레이어의 경우 현재 손패 정보를 유지
        if (isLocalPlayer) {
          return {
            ...player,
            hand: player.hand || []  // 새로운 핸드 정보가 있으면 사용, 없으면 빈 배열
          }
        }

        // 다른 플레이어의 경우 카드 수만 표시
        return {
          ...player,
          hand: Array(player.hand?.length || 0).fill({ hidden: true })
        }
      })
    }

    // 액션 카운트 업데이트
    if (typeof newState.actionsRemaining === 'number') {
      updatedState.actionsRemaining = newState.actionsRemaining
    }

    // 덱과 버린 카드 더미 업데이트
    if (newState.deck) updatedState.deck = newState.deck
    if (newState.discardPile) updatedState.discardPile = newState.discardPile

    gameState.value = updatedState

    console.log('State updated:', {
      localPlayerId: gameState.value.localPlayerId,
      actionsRemaining: gameState.value.actionsRemaining,
      players: gameState.value.players.map(p => ({
        id: p.id,
        handCount: p.hand?.length,
        isLocal: p.id === gameState.value.localPlayerId
      }))
    })
  }

  function updateHandCount(playerId, count) {
    if (!playerId) return

    const updatedHandCount = { ...gameState.value.handCount }
    updatedHandCount[playerId] = count

    gameState.value = {
      ...gameState.value,
      handCount: updatedHandCount
    }
  }

  function needsTarget(cardType) {
    const targetNeededCards = [
      'mud',
      'bath',
      'barn',
      'lightning',
      'lightning_rod',
      'barn_lock',
      'beautiful_pig'
    ]
    return targetNeededCards.includes(cardType)
  }

  function updateLastAction(action) {
    if (!action) return

    gameState.value = {
      ...gameState.value,
      lastAction: action
    }
  }

  function startNewTurn(playerId, turnCount) {
    const playerIndex = gameState.value.players.findIndex(p => p.id === playerId)
    if (playerIndex === -1) return

    gameState.value = {
      ...gameState.value,
      currentPlayerIndex: playerIndex,
      turnCount: turnCount || gameState.value.turnCount + 1,
      actionsRemaining: 1,
      lastAction: null
    }
  }

  function endCurrentTurn() {
    gameState.value = {
      ...gameState.value,
      actionsRemaining: 0
    }
  }

  function joinRoom(roomData) {
    if (!roomData) return

    const { roomId, players, gameMode, maxPlayers, owner, status } = roomData

    gameState.value = {
      ...gameState.value,
      roomId,
      players,
      gameMode,
      maxPlayers,
      owner,
      status,
      currentRoom: roomData
    }

    updateRoomState(roomData)
  }

  function updateRoomOwner(newOwnerId) {
    if (!newOwnerId) return

    const updatedState = {
      ...gameState.value,
      owner: newOwnerId
    }

    if (updatedState.currentRoom) {
      updatedState.currentRoom = {
        ...updatedState.currentRoom,
        owner: newOwnerId
      }
    }

    gameState.value = updatedState
  }

  function validateRoomState() {
    const { roomId, players } = gameState.value

    return {
      isValid: Boolean(roomId && players.length > 0),
      canStart: players.length >= 2 && players.every(p => p.ready),
      playerCount: players.length,
      maxPlayers: gameState.value.maxPlayers
    }
  }

  const selectCard = (card) => {
    gameState.value = {
      ...gameState.value,
      selectedCard: card
    }
  }

  function handleCardAction(action) {
    if (!action) return false

    const { type, playerId, card, targetPigId, targetPlayerId } = action

    switch (type) {
      case 'PLAY_CARD':
        return handlePlayCard(card, targetPigId, targetPlayerId)
      case 'DISCARD_CARD':
        return discardCard(card.id)
      default:
        return false
    }
  }

  function handlePlayCard(card, targetPigId, targetPlayerId) {
    const player = localPlayer.value
    if (!player) return false

    const cardIndex = player.hand.findIndex(c => c.id === card.id)
    if (cardIndex === -1) return false

    const updatedPlayers = [...gameState.value.players]
    const playerIndex = updatedPlayers.findIndex(p => p.id === gameState.value.localPlayerId)

    // 카드 제거
    updatedPlayers[playerIndex].hand = [
      ...updatedPlayers[playerIndex].hand.slice(0, cardIndex),
      ...updatedPlayers[playerIndex].hand.slice(cardIndex + 1)
    ]

    gameState.value = {
      ...gameState.value,
      players: updatedPlayers,
      discardPile: [...gameState.value.discardPile, card],
      actionsRemaining: gameState.value.actionsRemaining - 1
    }

    return true
  }

  // 버린 카드 더미에 카드 추가
  function addToDiscardPile(card) {
    console.log('Adding card to discard pile:', card)
    if (!card) return

    gameState.value = {
      ...gameState.value,
      discardPile: [...gameState.value.discardPile, card]
    }

    console.log('Updated discard pile:', gameState.value.discardPile)
  }

  // updatePlayerHandCount 메서드도 확인/수정
  function updatePlayerHandCount(playerId, newCount = null) {
    console.log('Updating player hand count:', {playerId, newCount})

    const players = [...gameState.value.players]
    const playerIndex = players.findIndex(p => p.id === playerId)
    if (playerIndex === -1) return

    const player = players[playerIndex]
    const handCount = newCount !== null ? newCount :
      (player.hand ? player.hand.length - 1 : 0)

    players[playerIndex] = {
      ...player,
      hand: player.id === gameState.value.localPlayerId ?
        player.hand : Array(handCount).fill({hidden: true})
    }

    gameState.value = {
      ...gameState.value,
      players
    }

    console.log('Updated player hand:', {
      playerId,
      newHandCount: handCount
    })
  }

  // Return 구문은 이전과 동일
  return {
    // State
    gameState,

    // Getters
    currentPlayer,
    isCurrentPlayer,
    localPlayer,
    opponents,
    isGameActive,
    hasWinner,
    deckCount,
    discardPileCount,
    canPlaySelected,
    games,
    currentRoom,
    roomState,
    roomPlayers,
    isRoomOwner,
    canStartGame,

    // Methods
    setLocalPlayerId,
    setCurrentRoom,
    resetRoom,
    initializeGame,
    updateGameState,
    handleCardEffect,
    canPlayCard,
    drawCard,
    discardCard,
    handleDiscardCard,
    updateHandCount,
    checkWinCondition,
    setGameStatus,
    showGameMessage,
    setError,
    canTargetPig,
    needsTarget,
    updateGames,
    addGame,
    updateLastAction,
    updatePlayerHandCount,
    addToDiscardPile,
    startNewTurn,
    endCurrentTurn,
    updateRoomState,
    joinRoom,
    leaveRoom,
    selectCard,
    updateRoomOwner,
    validateRoomState,
    syncGames,
    removeGame,
    updateGameInList
  }
})