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
function handleCardPlay(gameState, cardId, targetId) {
  // 실제 카드 효과 처리 로직 구현
  return {
    success: true,
    action: {
      type: 'playCard',
      cardId,
      targetId
    }
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