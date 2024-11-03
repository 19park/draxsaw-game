// server/websocket/index.js
import { Server } from 'socket.io'
import { nanoid } from 'nanoid'

export default function setupWebSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type']
    },
    transports: ['polling', 'websocket'],
    path: '/socket.io/',
    serveClient: false,
    pingTimeout: 30000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e8,
    allowEIO3: true
  })

  // 게임 룸 관리
  const gameRooms = new Map()

  // 유틸리티 함수들
  const createDeck = (gameMode) => {
    const basicCards = [
      ...Array(21).fill().map((_, i) => ({ id: `mud-${i}`, type: 'mud' })),
      ...Array(9).fill().map((_, i) => ({ id: `barn-${i}`, type: 'barn' })),
      ...Array(8).fill().map((_, i) => ({ id: `bath-${i}`, type: 'bath' })),
      ...Array(4).fill().map((_, i) => ({ id: `rain-${i}`, type: 'rain' })),
      ...Array(4).fill().map((_, i) => ({ id: `lightning-${i}`, type: 'lightning' })),
      ...Array(4).fill().map((_, i) => ({ id: `lightning_rod-${i}`, type: 'lightning_rod' })),
      ...Array(4).fill().map((_, i) => ({ id: `barn_lock-${i}`, type: 'barn_lock' }))
    ]

    if (gameMode === 'expansion') {
      const expansionCards = [
        ...Array(16).fill().map((_, i) => ({ id: `beautiful_pig-${i}`, type: 'beautiful_pig' })),
        ...Array(12).fill().map((_, i) => ({ id: `escape-${i}`, type: 'escape' })),
        ...Array(4).fill().map((_, i) => ({ id: `lucky_bird-${i}`, type: 'lucky_bird' }))
      ]
      return shuffleDeck([...basicCards, ...expansionCards])
    }

    return shuffleDeck(basicCards)
  }

  const shuffleDeck = (deck) => {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]]
    }
    return deck
  }

  const createInitialGameState = (players, gameMode) => {
    const deck = createDeck(gameMode)
    console.log('Initial deck created:', deck.map(card => ({id: card.id, type: card.type})))

    const playerStates = players.map(player => {
      const hand = deck.splice(0, 3)
      console.log(`Initial hand for player ${player.id}:`, hand.map(card => ({id: card.id, type: card.type})))

      return {
        id: player.id,
        name: player.name,
        pigs: Array(3).fill().map((_, i) => ({
          id: `${player.id}-pig-${i}`,  // 단순한 숫자 인덱스 사용
          status: 'clean',
          barn: null
        })),
        hand: hand,
        ready: false
      }
    })

    const initialState = {
      deck,
      discardPile: [],
      players: playerStates,
      currentPlayerIndex: 0,
      turnCount: 0,
      gameMode,
      status: 'playing',
      lastAction: null
    }

    console.log('Game initialized:', {
      playerStates: initialState.players.map(p => ({
        id: p.id,
        handCount: p.hand.length,
        cards: p.hand.map(card => ({id: card.id, type: card.type}))
      })),
      deckSize: initialState.deck.length
    })

    return initialState
  }

  // 게임 상태 검증 함수들
  const validateGameAction = (room, playerId) => {
    console.log('Validating game action:', { room, playerId })
    if (!room) {
      throw new Error('게임룸을 찾을 수 없습니다.')
    }
    if (room.status !== 'playing') {
      throw new Error('게임이 진행중이 아닙니다.')
    }
    if (room.players[room.gameState.currentPlayerIndex].id !== playerId) {
      throw new Error('자신의 턴이 아닙니다.')
    }
  }

  const validateCardPlay = (gameState, cardId, playerId) => {
    const player = gameState.players.find(p => p.id === playerId)
    if (!player) {
      console.log('Player validation failed:', {
        searchId: playerId,
        availablePlayers: gameState.players.map(p => p.id)
      })
      throw new Error('플레이어를 찾을 수 없습니다.')
    }

    console.log('Player hand check:', {
      playerId,
      handLength: player.hand?.length,
      hand: player.hand
    })

    if (!player.hand || !Array.isArray(player.hand)) {
      throw new Error('플레이어의 카드 정보가 올바르지 않습니다.')
    }

    const cardIndex = player.hand.findIndex(card => card.id === cardId)
    if (cardIndex === -1) {
      console.log('Card not found:', {
        searchId: cardId,
        availableCards: player.hand.map(c => c.id)
      })
      throw new Error('카드를 찾을 수 없습니다.')
    }

    return { player, cardIndex }
  }

  // 소켓 이벤트 핸들러
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // 연결 즉시 게임 목록 전송
    broadcastGamesList()

    // 연결 상태 확인
    socket.on('ping', () => socket.emit('pong'))

    // 게임 목록 요청 처리
    socket.on('getGames', () => {
      console.log('Games list requested by:', socket.id)
      broadcastGamesList()
    })

    // 게임 생성
    socket.on('createGame', ({ gameMode = 'basic', maxPlayers = 4 }) => {
      try {
        console.log('Creating new game:', { gameMode, maxPlayers, creator: socket.id })

        const roomId = nanoid(10)
        const newRoom = {
          id: roomId,
          players: [{
            id: socket.id,
            name: `Player 1`,
            ready: false
          }],
          maxPlayers,
          gameMode,
          status: 'waiting',
          owner: socket.id,
          gameState: null,
          createdAt: Date.now()
        }

        gameRooms.set(roomId, newRoom)
        socket.join(roomId)

        // 생성된 방 정보 전송
        socket.emit('gameCreated', { roomId, room: newRoom })

        // 전체 게임 목록 즉시 업데이트
        broadcastGamesList()

        console.log('Game created:', roomId, 'Total games:', gameRooms.size)
      } catch (error) {
        console.error('Game creation error:', error)
        socket.emit('error', { message: '게임 생성 중 오류가 발생했습니다.' })
      }
    })

    socket.on('getGames', () => {
      console.log('Games list requested by:', socket.id)
      broadcastGamesList()
    })

    // 연결 시 게임 목록 전송
    socket.on('connect', () => {
      console.log('Client connected:', socket.id)
      broadcastGamesList()
    })

    // 방 참여
    socket.on('joinRoom', ({ roomId, playerName }) => {
      try {
        const room = gameRooms.get(roomId)
        if (!room) {
          throw new Error('존재하지 않는 게임입니다.')
        }

        if (room.players.length >= room.maxPlayers) {
          throw new Error('게임이 가득 찼습니다.')
        }

        if (room.status !== 'waiting') {
          throw new Error('이미 시작된 게임입니다.')
        }

        const existingPlayer = room.players.find(p => p.id === socket.id)
        if (!existingPlayer) {
          room.players.push({
            id: socket.id,
            name: playerName,
            ready: false
          })
        }

        socket.join(roomId)
        io.to(roomId).emit('roomState', {
          id: roomId,
          players: room.players,
          owner: room.owner,
          gameMode: room.gameMode,
          maxPlayers: room.maxPlayers,
          status: room.status
        })

        broadcastGamesList()

      } catch (error) {
        socket.emit('error', { message: error.message })
      }
    })

    // 준비 상태 토글
    socket.on('toggleReady', ({ roomId, ready }) => {
      try {
        const room = gameRooms.get(roomId)
        if (!room) {
          throw new Error('게임룸을 찾을 수 없습니다.')
        }

        const player = room.players.find(p => p.id === socket.id)
        if (player) {
          player.ready = ready
          io.to(roomId).emit('roomState', {
            players: room.players,
            gameMode: room.gameMode,
            owner: room.owner
          })
        }

      } catch (error) {
        socket.emit('error', { message: error.message })
      }
    })

    // 게임 시작
    socket.on('startGame', ({ roomId }) => {
      try {
        const room = gameRooms.get(roomId)
        if (!room) {
          throw new Error('게임룸을 찾을 수 없습니다.')
        }

        if (room.owner !== socket.id) {
          throw new Error('게임을 시작할 권한이 없습니다.')
        }

        if (room.players.length < 2) {
          throw new Error('최소 2명의 플레이어가 필요합니다.')
        }

        if (!room.players.every(p => p.ready)) {
          throw new Error('모든 플레이어가 준비를 완료해야 합니다.')
        }

        room.status = 'playing'
        room.gameState = createInitialGameState(room.players, room.gameMode)

        io.to(roomId).emit('gameStarted', {
          ...room.gameState,
          roomId: room.id,
          gameMode: room.gameMode,
          status: room.status,
          currentPlayerIndex: 0
        })

        broadcastGamesList()

      } catch (error) {
        socket.emit('error', { message: error.message })
        console.error('Game start error:', error)
      }
    })

    // 카드 뽑기
    socket.on('drawCard', ({ roomId, playerId }) => {
      try {
        const room = gameRooms.get(roomId)
        if (playerId !== socket.id) {
          throw new Error('자신의 턴에만 카드를 뽑을 수 있습니다.')
        }
        validateGameAction(room, playerId)

        const gameState = room.gameState
        const currentPlayer = gameState.players.find(p => p.id === playerId)

        if (!currentPlayer) {
          throw new Error('플레이어를 찾을 수 없습니다.')
        }

        if (currentPlayer.hand.length >= 3) {
          throw new Error('더 이상 카드를 뽑을 수 없습니다.')
        }

        // 덱이 비어있으면 버린 카드 덱을 섞어서 새로운 덱 만들기
        if (gameState.deck.length === 0) {
          if (gameState.discardPile.length === 0) {
            throw new Error('더 이상 뽑을 카드가 없습니다.')
          }
          gameState.deck = shuffleDeck([...gameState.discardPile])
          gameState.discardPile = []
        }

        const drawnCard = gameState.deck.pop()
        currentPlayer.hand.push(drawnCard)

        io.to(roomId).emit('cardDrawn', {
          playerId: playerId,
          handCount: currentPlayer.hand.length,
        })

        io.to(roomId).emit('gameStateUpdated', gameState)

      } catch (error) {
        socket.emit('error', { message: error.message })
      }
    })

    // 카드 버리기
    socket.on('discardCard', ({ roomId, cardId, playerId }) => {
      console.log('Received discard request:', {
        roomId, cardId, playerId,
        socketId: socket.id,
        matchesSocket: playerId === socket.id
      })

      try {
        const room = gameRooms.get(roomId)
        if (!room) {
          throw new Error('게임룸을 찾을 수 없습니다.')
        }

        // 더 자세한 게임 상태 로깅
        console.log('Current game state:', {
          players: room.gameState.players.map(p => ({
            id: p.id,
            handSize: p.hand?.length,
            cards: p.hand?.map(card => ({id: card.id, type: card.type}))
          })),
          currentPlayerIndex: room.gameState.currentPlayerIndex,
          discardPileSize: room.gameState.discardPile.length
        })

        const currentPlayer = room.gameState.players.find(p => p.id === playerId)
        if (!currentPlayer) {
          console.log('Player not found:', {
            searchId: playerId,
            availablePlayers: room.gameState.players.map(p => p.id)
          })
          throw new Error('플레이어를 찾을 수 없습니다.')
        }

        // 권한 검증 - 자신의 카드만 버릴 수 있음
        if (currentPlayer.id !== socket.id) {
          throw new Error('자신의 카드만 버릴 수 있습니다.')
        }

        validateGameAction(room, playerId)

        console.log('Found player:', {
          playerId: currentPlayer.id,
          handSize: currentPlayer.hand?.length,
          cards: currentPlayer.hand?.map(c => c.id)
        })

        // 카드 찾기
        const cardIndex = currentPlayer.hand.findIndex(card => card.id === cardId)
        if (cardIndex === -1) {
          console.log('Card not found in hand:', {
            searchCardId: cardId,
            playerHand: currentPlayer.hand.map(c => c.id)
          })
          throw new Error('카드를 찾을 수 없습니다.'+ JSON.stringify(currentPlayer.hand))
        }

        // 카드 버리기 처리
        // 카드 버리기 처리
        const discardedCard = currentPlayer.hand.splice(cardIndex, 1)[0]
        room.gameState.discardPile.push(discardedCard)

        // actionsRemaining 감소
        room.gameState.actionsRemaining = Math.max(0, room.gameState.actionsRemaining - 1)

        console.log('Card discarded successfully:', {
          discardedCard,
          newHandSize: currentPlayer.hand.length,
          discardPileSize: room.gameState.discardPile.length,
          actionsRemaining: room.gameState.actionsRemaining
        })

        // 이벤트 발송 시 현재 상태 정보 포함
        io.to(roomId).emit('cardDiscarded', {
          playerId: currentPlayer.id,
          card: discardedCard,
          handCount: currentPlayer.hand.length,
          actionsRemaining: room.gameState.actionsRemaining
        })

        // 전체 게임 상태 업데이트를 명시적으로 전송
        io.to(roomId).emit('gameStateUpdated', {
          ...room.gameState,
          players: room.gameState.players.map(p => ({
            ...p,
            hand: p.id === playerId ? p.hand : Array(p.hand.length).fill({ hidden: true })
          }))
        })

      } catch (error) {
        console.error('Discard card error:', error)
        socket.emit('error', { message: error.message })
      }
    })

    // 카드 사용
    socket.on('playCard', ({ roomId, cardId, targetPigId, targetPlayerId, playerId }) => {
      console.log('Received playCard event:', {
        roomId, cardId, targetPigId, targetPlayerId, playerId
      })

      try {
        const room = gameRooms.get(roomId)
        if (!room) throw new Error('게임룸을 찾을 수 없습니다.')

        // 게임 상태 로깅
        console.log('Current game state:', {
          players: room.gameState.players.map(p => ({
            id: p.id,
            pigs: p.pigs.map(pig => ({
              id: pig.id,
              status: pig.status
            }))
          })),
          currentPlayerIndex: room.gameState.currentPlayerIndex
        })

        validateGameAction(room, playerId)
        const gameState = room.gameState

        const { player, cardIndex } = validateCardPlay(gameState, cardId, playerId)
        const card = player.hand[cardIndex]

        console.log('Playing card:', {
          card,
          playerHand: player.hand,
          targetPig: targetPigId,
          targetPlayer: targetPlayerId
        })

        const result = handleCardPlay(gameState, card, targetPigId, targetPlayerId)
        console.log('Card play result:', result)

        if (!result.success) {
          throw new Error(result.message)
        }

        // 카드 제거 및 효과 적용
        player.hand.splice(cardIndex, 1)
        gameState.discardPile.push(card)
        gameState.actionsRemaining--

        // 이벤트 발송
        io.to(roomId).emit('cardPlayed', {
          playerId,
          card,
          targetPigId,
          targetPlayerId,
          effect: result.effect
        })

        // 게임 상태 업데이트
        io.to(roomId).emit('gameStateUpdated', {
          ...gameState,
          players: gameState.players.map(p => ({
            ...p,
            hand: p.id === playerId ? p.hand : Array(p.hand.length).fill({ hidden: true })
          }))
        })

      } catch (error) {
        console.error('Error in playCard:', error)
        socket.emit('error', { message: error.message })
      }
    })

    // 턴 종료
    socket.on('endTurn', ({ roomId, playerId }) => {
      try {
        const room = gameRooms.get(roomId)
        if (playerId !== socket.id) {
          throw new Error('자신의 턴만 종료할 수 있습니다.')
        }
        validateGameAction(room, playerId)

        const gameState = room.gameState

        // 현재 턴 종료 알림
        io.to(roomId).emit('turnEnded', {
          playerId: playerId
        })

        // 다음 플레이어로 턴 전환
        gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length
        gameState.turnCount++
        gameState.lastAction = null

        // 새로운 턴 시작 알림
        io.to(roomId).emit('turnStarted', {
          playerId: gameState.players[gameState.currentPlayerIndex].id,
          turnCount: gameState.turnCount
        })

        io.to(roomId).emit('gameStateUpdated', gameState)

      } catch (error) {
        socket.emit('error', { message: error.message })
      }
    })

    // 게임방 나가기
    socket.on('leaveRoom', ({ roomId }) => {
      try {
        const room = gameRooms.get(roomId)
        if (!room) return

        handlePlayerLeave(room, socket.id)
        socket.leave(roomId)

        if (room.players.length === 0) {
          gameRooms.delete(roomId)
        } else {
          io.to(roomId).emit('roomUpdated', {
            players: room.players,
            owner: room.owner,
            gameMode: room.gameMode
          })
        }

        broadcastGamesList()

      } catch (error) {
        console.error('Leave room error:', error)
      }
    })

    socket.on('connect', () => {
      console.log('Client connected:', socket.id)
      broadcastGamesList()  // 연결 직후 현재 게임 목록 전송
    })

    // 연결 해제 핸들러 수정
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
      let roomUpdated = false

      // 플레이어가 속한 방 찾기 및 업데이트
      for (const [roomId, room] of gameRooms.entries()) {
        if (room.players.some(p => p.id === socket.id)) {
          handlePlayerLeave(room, socket.id)

          if (room.players.length === 0) {
            gameRooms.delete(roomId)
          } else {
            io.to(roomId).emit('roomUpdated', {
              players: room.players,
              owner: room.owner,
              gameMode: room.gameMode
            })
          }
          roomUpdated = true
        }
      }

      // 방 정보가 변경되었다면 게임 목록 업데이트
      if (roomUpdated) {
        broadcastGamesList()
      }
    })
  })

  // 유틸리티 함수들
  function handlePlayerLeave(room, playerId) {
    room.players = room.players.filter(p => p.id !== playerId)
    if (room.owner === playerId && room.players.length > 0) {
      room.owner = room.players[0].id
    }
  }

  // 게임 목록 브로드캐스트 함수를 먼저 정의
  function broadcastGamesList() {
    try {
      const gamesList = Array.from(gameRooms.values())
        .filter(room => room.status === 'waiting')
        .map(room => ({
          id: room.id,
          playerCount: room.players.length,
          maxPlayers: room.maxPlayers,
          gameMode: room.gameMode,
          owner: room.owner,
          status: room.status
        }))

      // 전체 클라이언트에게 즉시 브로드캐스트
      io.sockets.emit('gamesList', gamesList)
      console.log('Broadcasting games list:', gamesList)
    } catch (error) {
      console.error('Error broadcasting games list:', error)
    }
  }

  // 더 자주 브로드캐스트하도록 설정
  const BROADCAST_INTERVAL = 2000  // 2초마다
  setInterval(broadcastGamesList, BROADCAST_INTERVAL)

  setInterval(() => {
    // 오래된 게임 정리
    const now = Date.now()
    for (const [roomId, room] of gameRooms.entries()) {
      if (room.status === 'waiting' && now - room.createdAt > 24 * 60 * 60 * 1000) {
        gameRooms.delete(roomId)
      }
    }
    // 게임 목록 브로드캐스트
    broadcastGamesList()
  }, 3000)  // 3초마다 실행

  // 주기적인 게임 목록 업데이트 및 정리
  const SYNC_INTERVAL = 3000 // 3초
  setInterval(() => {
    // 오래된 게임 정리
    const now = Date.now()
    let needsUpdate = false

    for (const [roomId, room] of gameRooms.entries()) {
      // 24시간 이상 된 대기 중인 게임 삭제
      if (room.status === 'waiting' && now - room.createdAt > 24 * 60 * 60 * 1000) {
        gameRooms.delete(roomId)
        needsUpdate = true
      }
    }

    // 변경사항이 있을 때만 브로드캐스트
    if (needsUpdate) {
      broadcastGamesList()
    }
  }, SYNC_INTERVAL)
  return io
}


function handleCardPlay(gameState, card, targetPigId, targetPlayerId) {
  console.log('Handle card play input:', {
    card,
    targetPigId,
    targetPlayerId,
    currentPlayerIndex: gameState.currentPlayerIndex,
  })

  const currentPlayer = gameState.players[gameState.currentPlayerIndex]
  const targetPlayer = targetPlayerId ?
    gameState.players.find(p => p.id === targetPlayerId) : currentPlayer

  if (!targetPlayer) {
    return { success: false, message: '대상 플레이어를 찾을 수 없습니다.' }
  }

  console.log('Finding target pig:', {
    targetPigId,
    availablePigIds: targetPlayer.pigs.map(p => p.id)
  })

  // 돼지 ID의 인덱스 부분만 추출하여 비교
  const targetPig = targetPigId ?
    targetPlayer.pigs.find(pig => {
      const pigIndex = pig.id.split('-').pop()
      const targetIndex = targetPigId.split('-').pop()
      return pigIndex === targetIndex
    }) : null

  if (!targetPig) {
    return { success: false, message: '대상 돼지를 찾을 수 없습니다.' }
  }

  switch (card.type) {
    case 'mud': {
      console.log('Attempting to apply mud card:', {
        pigId: targetPig.id,
        currentStatus: targetPig.status
      })

      if (targetPig.status !== 'clean') {
        console.log('Invalid pig status for mud:', targetPig.status)
        return { success: false, message: '깨끗한 돼지만 더럽힐 수 있습니다.' }
      }

      targetPig.status = 'dirty'
      console.log('Pig status changed to:', targetPig.status)

      return {
        success: true,
        effect: {
          type: 'STATUS_CHANGE',
          pigId: targetPigId,
          playerId: targetPlayerId,
          from: 'clean',
          to: 'dirty'
        }
      }
    }

    case 'barn':
      // 헛간 카드: 돼지에게 헛간 설치
      if (!targetPig || targetPig.barn) {
        return { success: false, message: '이미 헛간이 있거나 유효하지 않은 돼지입니다.' }
      }
      targetPig.barn = {
        hasLightningRod: false,
        isLocked: false
      }
      return {
        success: true,
        effect: {
          type: 'ADD_BARN',
          pigId: targetPigId,
          playerId: targetPlayerId
        }
      }

    case 'bath':
      // 목욕 카드: 더러운 돼지를 깨끗하게 만듦
      if (!targetPig ||
        targetPig.status !== 'dirty' ||
        (targetPig.barn && targetPig.barn.isLocked)) {
        return { success: false, message: '목욕시킬 수 없는 돼지입니다.' }
      }
      targetPig.status = 'clean'
      return {
        success: true,
        effect: {
          type: 'STATUS_CHANGE',
          pigId: targetPigId,
          playerId: targetPlayerId,
          from: 'dirty',
          to: 'clean'
        }
      }

    case 'rain':
      // 비 카드: 헛간이 없는 모든 더러운 돼지를 깨끗하게 만듦
      let rainEffect = false
      gameState.players.forEach(player => {
        player.pigs.forEach(pig => {
          if (pig.status === 'dirty' && !pig.barn) {
            pig.status = 'clean'
            rainEffect = true
          }
        })
      })
      if (!rainEffect) {
        return { success: false, message: '비의 영향을 받을 수 있는 돼지가 없습니다.' }
      }
      return {
        success: true,
        effect: {
          type: 'RAIN',
          affectedPigs: gameState.players.map(player => ({
            playerId: player.id,
            pigs: player.pigs.map(pig => ({
              pigId: pig.id,
              wasAffected: pig.status === 'clean' && !pig.barn
            }))
          }))
        }
      }

    case 'lightning':
      // 벼락 카드: 피뢰침이 없는 헛간을 파괴
      if (!targetPig || !targetPig.barn || targetPig.barn.hasLightningRod) {
        return { success: false, message: '파괴할 수 있는 헛간이 없습니다.' }
      }
      delete targetPig.barn
      return {
        success: true,
        effect: {
          type: 'DESTROY_BARN',
          pigId: targetPigId,
          playerId: targetPlayerId
        }
      }

    case 'lightning_rod':
      // 피뢰침 카드: 헛간에 피뢰침 설치
      if (!targetPig || !targetPig.barn || targetPig.barn.hasLightningRod) {
        return { success: false, message: '피뢰침을 설치할 수 없는 헛간입니다.' }
      }
      targetPig.barn.hasLightningRod = true
      return {
        success: true,
        effect: {
          type: 'ADD_LIGHTNING_ROD',
          pigId: targetPigId,
          playerId: targetPlayerId
        }
      }

    case 'barn_lock':
      // 헛간 잠금 카드: 헛간을 잠가서 목욕으로부터 보호
      if (!targetPig || !targetPig.barn || targetPig.barn.isLocked) {
        return { success: false, message: '잠글 수 없는 헛간입니다.' }
      }
      targetPig.barn.isLocked = true
      return {
        success: true,
        effect: {
          type: 'LOCK_BARN',
          pigId: targetPigId,
          playerId: targetPlayerId
        }
      }

    case 'beautiful_pig':
      // 아름다운 돼지 카드 (확장팩): 돼지를 아름답게 만듦
      if (!targetPig || targetPig.status === 'beautiful' ||
        (targetPig.barn && targetPig.barn.isLocked)) {
        return { success: false, message: '아름답게 만들 수 없는 돼지입니다.' }
      }
      targetPig.status = 'beautiful'
      return {
        success: true,
        effect: {
          type: 'STATUS_CHANGE',
          pigId: targetPigId,
          playerId: targetPlayerId,
          from: targetPig.status,
          to: 'beautiful'
        }
      }

    case 'escape':
      // 도망 카드 (확장팩): 아름다운 돼지를 원래 상태로 되돌림
      if (!targetPig || targetPig.status !== 'beautiful') {
        return { success: false, message: '도망갈 수 없는 돼지입니다.' }
      }
      targetPig.status = 'clean'
      return {
        success: true,
        effect: {
          type: 'STATUS_CHANGE',
          pigId: targetPigId,
          playerId: targetPlayerId,
          from: 'beautiful',
          to: 'clean'
        }
      }

    case 'lucky_bird':
      // 행운의 새 카드 (확장팩): 손에 있는 다른 모든 카드를 즉시 사용
      if (currentPlayer.hand.length <= 1) {
        return { success: false, message: '사용할 수 있는 다른 카드가 없습니다.' }
      }
      return {
        success: true,
        effect: {
          type: 'LUCKY_BIRD',
          playerId: currentPlayer.id
        }
      }

    default:
      return { success: false, message: '알 수 없는 카드 타입입니다.' }
  }
}

// 승리 조건 체크
function checkWinCondition(gameState) {
  for (const player of gameState.players) {
    if (player.pigs.every(pig => pig.status === 'dirty')) {
      return player
    }
    if (gameState.gameMode === 'expansion' &&
      player.pigs.every(pig => pig.status === 'beautiful')) {
      return player
    }
  }
  return null
}