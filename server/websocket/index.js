// server/websocket/index.js
import { Server } from 'socket.io'
import { nanoid } from 'nanoid'

export default function (httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'development'
        ? ['http://localhost:3000', 'http://127.0.0.1:3000']
        : process.env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e8,
    path: '/socket.io/',
    allowEIO3: true
  })

  // 게임 룸과 상태 관리
  const gameRooms = new Map()
  // 카드 덱 생성 함수
  const createDeck = (gameMode) => {
    let deck = [
      ...Array(21).fill().map((_, i) => ({ id: `mud-${i}`, type: 'mud' })),
      ...Array(9).fill().map((_, i) => ({ id: `barn-${i}`, type: 'barn' })),
      ...Array(8).fill().map((_, i) => ({ id: `bath-${i}`, type: 'bath' })),
      ...Array(4).fill().map((_, i) => ({ id: `rain-${i}`, type: 'rain' })),
      ...Array(4).fill().map((_, i) => ({ id: `lightning-${i}`, type: 'lightning' })),
      ...Array(4).fill().map((_, i) => ({ id: `lightning_rod-${i}`, type: 'lightning_rod' })),
      ...Array(4).fill().map((_, i) => ({ id: `barn_lock-${i}`, type: 'barn_lock' }))
    ]

    // 확장팩 카드 추가
    if (gameMode === 'expansion') {
      deck = deck.concat([
        ...Array(16).fill().map((_, i) => ({ id: `beautiful_pig-${i}`, type: 'beautiful_pig' })),
        ...Array(12).fill().map((_, i) => ({ id: `escape-${i}`, type: 'escape' })),
        ...Array(4).fill().map((_, i) => ({ id: `lucky_bird-${i}`, type: 'lucky_bird' }))
      ])
    }

    // 덱 셔플
    return deck.sort(() => Math.random() - 0.5)
  }
  const createInitialGameState = (players, gameMode) => {
    console.log('Creating initial game state for:', {
      playerCount: players.length,
      gameMode
    })

    const deck = createDeck(gameMode)
    const playerStates = players.map(player => ({
      id: player.id,
      name: player.name,
      pigs: Array(3).fill().map(() => ({
        status: 'clean',
        barn: null
      })),
      hand: deck.splice(0, 3),
      ready: false
    }))

    return {
      deck,
      discardPile: [],
      players: playerStates,
      currentPlayerIndex: 0,
      turnCount: 0,
      gameMode
    }
  }

  // 연결 관리
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // 클라이언트 연결 상태 확인
    socket.on('ping', () => {
      socket.emit('pong')
    })


    // 게임 목록 조회
    socket.on('getGames', () => {
      const gameList = Array.from(gameRooms.values())
        .filter(room => room.status === 'waiting')
        .map(room => ({
          id: room.id,
          playerCount: room.players.length,
          maxPlayers: room.maxPlayers,
          gameMode: room.gameMode,
          owner: room.owner
        }))
      socket.emit('gamesList', gameList)
    })

    const broadcastGamesList = () => {
      const gamesList = Array.from(gameRooms.values())
        .filter(room => room.status === 'waiting')
        .map(room => ({
          id: room.id,
          playerCount: room.players.length,
          maxPlayers: room.maxPlayers,
          gameMode: room.gameMode,
          owner: room.owner
        }))

      io.emit('gamesList', gamesList)  // 모든 클라이언트에게 전송
    }

    socket.on('createGame', ({ gameMode = 'basic', maxPlayers = 4 }) => {
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

      // 게임 생성 알림
      socket.emit('gameCreated', { roomId })

      // 전체 게임 목록 업데이트를 모든 클라이언트에게 브로드캐스트
      broadcastGamesList()

      console.log(`Game created: ${roomId}, Current games:`,
        Array.from(gameRooms.keys()))
    })

    // 방 참여 시
    socket.on('joinRoom', ({ roomId, playerName }) => {
      console.log(`Player ${playerName} trying to join room ${roomId}`)
      const room = gameRooms.get(roomId)

      if (!room) {
        socket.emit('joinError', { message: '존재하지 않는 게임입니다.' })
        return
      }

      // 이미 방에 있는 플레이어인지 확인
      const existingPlayer = room.players.find(p => p.id === socket.id)
      if (!existingPlayer) {
        if (room.players.length >= room.maxPlayers) {
          socket.emit('joinError', { message: '게임이 가득 찼습니다.' })
          return
        }

        if (room.status !== 'waiting') {
          socket.emit('joinError', { message: '이미 시작된 게임입니다.' })
          return
        }

        const newPlayer = {
          id: socket.id,
          name: playerName,
          ready: false
        }
        room.players.push(newPlayer)
      }

      socket.join(roomId)

      const roomState = {
        id: roomId,
        players: room.players,
        owner: room.owner,
        gameMode: room.gameMode,
        maxPlayers: room.maxPlayers,
        status: room.status
      }

      // 모든 플레이어에게 업데이트된 상태 전송
      io.to(roomId).emit('roomState', roomState)

      // 게임 목록 업데이트
      const gamesList = Array.from(gameRooms.values())
        .filter(r => r.status === 'waiting')
        .map(r => ({
          id: r.id,
          playerCount: r.players.length,
          maxPlayers: r.maxPlayers,
          gameMode: r.gameMode
        }))

      io.emit('gamesList', gamesList)
    })

    // 준비 상태 토글
    socket.on('toggleReady', ({ roomId, ready }) => {
      const room = gameRooms.get(roomId)
      if (!room) return

      const player = room.players.find(p => p.id === socket.id)
      if (player) {
        player.ready = ready
        io.to(roomId).emit('roomState', {
          players: room.players,
          gameMode: room.gameMode,
          owner: room.owner
        })
      }
    })

    // 게임 시작
    socket.on('startGame', ({ roomId }) => {
      console.log(`Attempting to start game in room ${roomId}`)
      const room = gameRooms.get(roomId)

      if (!room) {
        socket.emit('error', { message: '게임룸을 찾을 수 없습니다.' })
        return
      }

      if (room.owner !== socket.id) {
        socket.emit('error', { message: '게임을 시작할 권한이 없습니다.' })
        return
      }

      if (room.players.length < 2) {
        socket.emit('error', { message: '최소 2명의 플레이어가 필요합니다.' })
        return
      }

      if (!room.players.every(p => p.ready)) {
        socket.emit('error', { message: '모든 플레이어가 준비를 완료해야 합니다.' })
        return
      }

      try {
        room.status = 'playing'
        room.gameState = createInitialGameState(room.players, room.gameMode)

        // 모든 클라이언트에게 게임 시작 알림과 초기 상태 전달
        io.to(roomId).emit('gameStarted', {
          ...room.gameState,
          roomId: room.id,
          gameMode: room.gameMode,
          status: room.status,
          currentPlayerIndex: 0
        })

        // 게임 리스트에서 제거
        broadcastGamesList()

        console.log('Game started successfully:', {
          roomId,
          playersCount: room.players.length,
          status: room.status
        })
      } catch (error) {
        console.error('Error starting game:', error)
        socket.emit('error', { message: '게임 시작 중 오류가 발생했습니다.' })
      }
    })

    // 카드 사용
    socket.on('playCard', ({ roomId, cardId, targetId }) => {
      const room = gameRooms.get(roomId)
      if (!room || room.status !== 'playing') return

      const gameState = room.gameState
      const currentPlayer = gameState.players[gameState.currentPlayerIndex]

      if (currentPlayer.id !== socket.id) {
        socket.emit('error', { message: '자신의 턴이 아닙니다.' })
        return
      }

      // 카드 사용 처리 로직
      const result = handleCardPlay(gameState, cardId, targetId)
      if (result.success) {
        gameState.lastAction = result.action
        io.to(roomId).emit('gameStateUpdated', gameState)

        // 승리 조건 체크
        const winner = checkWinCondition(gameState)
        if (winner) {
          room.status = 'finished'
          io.to(roomId).emit('gameEnded', { winner })
        }
      } else {
        socket.emit('error', { message: result.message })
      }
    })

    // 턴 종료
    socket.on('endTurn', ({ roomId }) => {
      const room = gameRooms.get(roomId)
      if (!room || room.status !== 'playing') return

      const gameState = room.gameState
      if (gameState.players[gameState.currentPlayerIndex].id !== socket.id) return

      // 다음 플레이어로 턴 전환
      gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length
      gameState.turnCount++
      gameState.lastAction = null

      io.to(roomId).emit('gameStateUpdated', gameState)
    })

    // 게임 나가기
    // 다른 이벤트에서도 게임 목록 업데이트가 필요할 때 broadcastGamesList 호출
    socket.on('leaveRoom', ({ roomId }) => {
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

      broadcastGamesList()  // 게임 목록 업데이트
    })

    socket.on('drawCard', ({ roomId }) => {
      const room = gameRooms.get(roomId)
      if (!room || room.status !== 'playing') return

      const gameState = room.gameState
      const currentPlayer = gameState.players.find(p => p.id === socket.id)

      if (!currentPlayer) {
        socket.emit('error', { message: '플레이어를 찾을 수 없습니다.' })
        return
      }

      if (currentPlayer.hand.length >= 3) {
        socket.emit('error', { message: '더 이상 카드를 뽑을 수 없습니다.' })
        return
      }

      // 덱에서 카드 뽑기
      if (gameState.deck.length === 0) {
        // 버린 카드 덱을 섞어서 새로운 덱 만들기
        if (gameState.discardPile.length === 0) {
          socket.emit('error', { message: '더 이상 뽑을 카드가 없습니다.' })
          return
        }
        gameState.deck = [...gameState.discardPile].sort(() => Math.random() - 0.5)
        gameState.discardPile = []
      }

      const drawnCard = gameState.deck.pop()
      currentPlayer.hand.push(drawnCard)

      io.to(roomId).emit('cardDrawn', {
        playerId: socket.id,
        handCount: currentPlayer.hand.length
      })

      io.to(roomId).emit('gameStateUpdated', gameState)
    })

    socket.on('discardCard', ({ roomId, cardId }) => {
      const room = gameRooms.get(roomId)
      if (!room || room.status !== 'playing') return

      const gameState = room.gameState
      const currentPlayer = gameState.players.find(p => p.id === socket.id)

      if (!currentPlayer) {
        socket.emit('error', { message: '플레이어를 찾을 수 없습니다.' })
        return
      }

      const cardIndex = currentPlayer.hand.findIndex(card => card.id === cardId)
      if (cardIndex === -1) {
        socket.emit('error', { message: '카드를 찾을 수 없습니다.' })
        return
      }

      // 카드 버리기
      const discardedCard = currentPlayer.hand.splice(cardIndex, 1)[0]
      gameState.discardPile.push(discardedCard)

      io.to(roomId).emit('cardDiscarded', {
        playerId: socket.id,
        card: discardedCard
      })

      io.to(roomId).emit('gameStateUpdated', gameState)
    })

// 기존의 playCard 핸들러 수정
    socket.on('playCard', ({ roomId, cardId, targetPigId, targetPlayerId }) => {
      const room = gameRooms.get(roomId)
      if (!room || room.status !== 'playing') return

      const gameState = room.gameState
      const currentPlayer = gameState.players[gameState.currentPlayerIndex]

      if (currentPlayer.id !== socket.id) {
        socket.emit('error', { message: '자신의 턴이 아닙니다.' })
        return
      }

      const cardIndex = currentPlayer.hand.findIndex(card => card.id === cardId)
      if (cardIndex === -1) {
        socket.emit('error', { message: '카드를 찾을 수 없습니다.' })
        return
      }

      const card = currentPlayer.hand[cardIndex]
      const result = handleCardPlay(gameState, card, targetPigId, targetPlayerId)

      if (result.success) {
        // 카드 제거 및 새 카드 뽑기
        currentPlayer.hand.splice(cardIndex, 1)
        gameState.discardPile.push(card)

        io.to(roomId).emit('cardPlayed', {
          playerId: socket.id,
          card,
          targetPigId,
          targetPlayerId,
          effect: result.effect
        })

        io.to(roomId).emit('gameStateUpdated', gameState)

        // 승리 조건 체크
        const winner = checkWinCondition(gameState)
        if (winner) {
          room.status = 'finished'
          io.to(roomId).emit('gameEnded', { winner })
        }
      } else {
        socket.emit('error', { message: result.message })
      }
    })

  // 기존의 endTurn 핸들러 수정
    socket.on('endTurn', ({ roomId }) => {
      const room = gameRooms.get(roomId)
      if (!room || room.status !== 'playing') return

      const gameState = room.gameState
      if (gameState.players[gameState.currentPlayerIndex].id !== socket.id) {
        socket.emit('error', { message: '자신의 턴이 아닙니다.' })
        return
      }

      // 현재 턴 종료 알림
      io.to(roomId).emit('turnEnded', {
        playerId: socket.id
      })

      // 다음 플레이어로 턴 전환
      gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length
      gameState.turnCount++

      // 새로운 턴 시작 알림
      io.to(roomId).emit('turnStarted', {
        playerId: gameState.players[gameState.currentPlayerIndex].id,
        turnCount: gameState.turnCount
      })

      io.to(roomId).emit('gameStateUpdated', gameState)
    })

    // 연결 해제
    // 연결 해제 시에도 게임 목록 업데이트
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
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
        }
      }

      broadcastGamesList()  // 게임 목록 업데이트
    })
  })

  // 플레이어 퇴장 처리
  const handlePlayerLeave = (room, playerId) => {
    room.players = room.players.filter(p => p.id !== playerId)
    if (room.owner === playerId && room.players.length > 0) {
      room.owner = room.players[0].id
    }
  }

  // 게임 상태 정리 (오래된 게임 룸 제거)
  setInterval(() => {
    const now = Date.now()
    for (const [roomId, room] of gameRooms.entries()) {
      if (room.status === 'waiting' && now - room.createdAt > 24 * 60 * 60 * 1000) {
        gameRooms.delete(roomId)
      }
    }
  }, 60 * 60 * 1000) // 1시간마다 체크

  return io
}

// 카드 사용 처리 로직
function handleCardPlay(gameState, card, targetPigId, targetPlayerId) {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex]
  const targetPlayer = targetPlayerId ?
    gameState.players.find(p => p.id === targetPlayerId) : currentPlayer
  const targetPig = targetPigId ?
    targetPlayer.pigs.find(pig => pig.id === targetPigId) : null

  switch (card.type) {
    case 'mud':
      // 진흙 카드: 깨끗한 돼지를 더럽힘
      if (!targetPig || targetPig.status !== 'clean') {
        return { success: false, message: '깨끗한 돼지만 더럽힐 수 있습니다.' }
      }
      targetPig.status = 'dirty'
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