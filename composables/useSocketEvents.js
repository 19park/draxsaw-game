// composables/useSocketEvents.js
import { ref } from 'vue'
import { useGameStore } from './useGameStore'
import { useRouter } from 'vue-router'

export function useSocketEvents() {
  const { $socket } = useNuxtApp()
  const gameStore = useGameStore()
  const router = useRouter()

  // 연결 상태 모니터링
  const isConnected = ref(false)
  const connectionError = ref(null)

  // 전역 이벤트 설정
  const setupGlobalEvents = () => {
    $socket.on('connect', () => {
      console.log('Socket connection established')
      isConnected.value = true
      connectionError.value = null
      $socket.emit('getGames')  // 연결 성공 시 게임 목록 요청
    })

    $socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      isConnected.value = false
    })

    $socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      isConnected.value = false
      connectionError.value = error.message
    })

    $socket.on('connect', handleConnect)
    $socket.on('disconnect', handleDisconnect)
    $socket.on('connect_error', handleConnectionError)
    $socket.on('error', handleError)
    $socket.on('gameStateUpdated', handleGameStateUpdate)
    $socket.on('gameStarted', handleGameStarted)
    $socket.on('gameEnded', handleGameEnded)
  }

  // 로비 이벤트 설정
  const setupLobbyEvents = () => {
    $socket.on('gamesList', (games) => {
      console.log('Received games list:', games)
      if (Array.isArray(games)) {
        gameStore.updateGames(games)
      }
    })

    $socket.on('gameCreated', ({ roomId, room }) => {
      console.log('Game created:', roomId)
      gameStore.setCurrentRoom(room)
      // 게임 생성 후 즉시 목록 갱신 요청
      $socket.emit('getGames')
      router.push(`/game/${roomId}`)
    })

    $socket.on('roomState', handleRoomState)
    $socket.on('joinError', handleJoinError)
  }

  // 룸 이벤트 설정
  const setupRoomEvents = () => {
    // 방 참여 관련 핸들러 추가
    $socket.on('roomJoined', ({ room, playerId }) => {
      console.log('Room joined:', { room, playerId })
      gameStore.setLocalPlayerId(playerId)
      gameStore.setCurrentRoom(room)
    })

    // 게임 상태 관련 핸들러 확장
    $socket.on('gameStateUpdated', (newState) => {
      console.log('Game state update received:', newState)
      gameStore.updateGameState(newState)
    })

    $socket.on('roomState', handleRoomState)
    $socket.on('roomUpdated', handleRoomUpdated)
    $socket.on('playerLeft', handlePlayerLeft)
    $socket.on('cardPlayed', handleCardPlayed)
    $socket.on('cardDrawn', handleCardDrawn)
    $socket.on('cardDiscarded', handleCardDiscarded)
    $socket.on('turnStarted', handleTurnStarted)
    $socket.on('turnEnded', handleTurnEnded)
  }

  // 연결 관련 핸들러
  const handleConnect = () => {
    console.log('Socket connected:', $socket.id)
    gameStore.setLocalPlayerId($socket.id)
    connectionError.value = null
  }

  const handleDisconnect = (reason) => {
    console.log('Socket disconnected:', reason)
    if (reason === 'io server disconnect') {
      $socket.connect()
    }
  }

  const handleConnectionError = (error) => {
    console.error('Connection error:', error)
    connectionError.value = error.message
  }

  // 에러 핸들러
  const handleError = ({ message }) => {
    gameStore.setError(message)
  }

  // 게임 상태 핸들러
  const handleGameStateUpdate = (newState) => {
    if (!newState) return
    gameStore.updateGameState(newState)
  }

  const handleGameStarted = (initialState) => {
    console.log('Game started with state:', initialState)
    gameStore.initializeGame(
      initialState.roomId,
      initialState.players,
      initialState.gameMode
    )
    gameStore.setGameStatus('playing')
  }

  const handleGameEnded = ({ winner }) => {
    gameStore.setGameStatus('finished')
    gameStore.showGameMessage(`게임 종료! 승자: ${winner.name}`)
  }

  // 로비 관련 핸들러
  const handleGamesList = (games) => {
    gameStore.updateGames(games)
  }

  const handleGameCreated = ({ roomId, room }) => {
    gameStore.setCurrentRoom(room)
    router.push(`/game/${roomId}`)
  }

  const handleJoinError = ({ message }) => {
    gameStore.setError(message)
    router.push('/lobby')
  }

  // 룸 관련 핸들러
  const handleRoomState = (state) => {
    gameStore.updateRoomState(state)
  }

  const handleRoomUpdated = (roomData) => {
    gameStore.updateRoomState(roomData)
  }

  const handlePlayerLeft = (roomData) => {
    gameStore.updateRoomState(roomData)
  }

  // 게임 플레이 관련 핸들러
  const handleCardPlayed = ({ playerId, card, targetPigId, targetPlayerId, effect }) => {
    if (effect) {
      gameStore.handleCardEffect(effect)
    }
    gameStore.updateLastAction({
      type: 'CARD_PLAYED',
      playerId,
      card,
      targetPigId,
      targetPlayerId
    })
  }

  const handleCardDrawn = ({ playerId, handCount }) => {
    gameStore.updateHandCount(playerId, handCount)
    if (playerId === gameStore.gameState.localPlayerId) {
      gameStore.showGameMessage('카드를 뽑았습니다.', 'success')
    }
  }

  const handleCardDiscarded = ({ playerId, card }) => {
    gameStore.addToDiscardPile(card)
    gameStore.updatePlayerHandCount(playerId)
  }

  const handleTurnStarted = ({ playerId, turnCount }) => {
    gameStore.startNewTurn(playerId, turnCount)
  }

  const handleTurnEnded = ({ playerId }) => {
    gameStore.endCurrentTurn()
  }

  // 이벤트 정리
  const clearEvents = (events = []) => {
    events.forEach(event => {
      $socket.off(event)
    })
  }

  // 연결 상태 체크
  const checkConnection = () => {
    return $socket.connected
  }

  return {
    setupGlobalEvents,
    isConnected,
    setupLobbyEvents,
    setupRoomEvents,
    clearEvents,
    checkConnection,
    connectionError
  }
}