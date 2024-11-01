// composables/useSocketEvents.ts
import { useGameStore } from './useGameStore'
import { useRouter } from 'vue-router'

export function useSocketEvents() {
  const { $socket } = useNuxtApp()
  const gameStore = useGameStore()
  const router = useRouter()

  const setupGlobalEvents = () => {
    $socket.on('connect', () => {
      console.log('Connected to server')
    })

    $socket.on('error', ({ message }) => {
      gameStore.setError(message)
    })

    $socket.on('gameStateUpdated', (newState) => {
      gameStore.updateGameState(newState)
    })

    $socket.on('gameStarted', (initialState) => {
      console.log('Game started with state:', initialState)
      gameStore.initializeGame(
        initialState.roomId,
        initialState.players,
        initialState.gameMode
      )
      // 상태를 playing으로 변경
      gameStore.status = 'playing'
    })

    $socket.on('gameEnded', ({ winner }) => {
      gameStore.status = 'finished'
      gameStore.setGameMessage(`게임 종료! 승자: ${winner.name}`)
    })
  }

  const setupLobbyEvents = () => {
    $socket.on('gamesList', (gamesList) => {
      gameStore.setGamesList(gamesList)
    })

    $socket.on('gameCreated', ({ roomId, room }) => {
      gameStore.setCurrentRoom(room)
      router.push(`/game/${roomId}`)
    })

    $socket.on('roomState', (state) => {
      gameStore.updateRoomState(state)
    })
  }

  const setupRoomEvents = () => {
    $socket.on('roomState', (state) => {
      gameStore.updateRoomState(state)
    })

    $socket.on('roomUpdated', (roomData) => {
      gameStore.updateRoomState(roomData)
    })

    $socket.on('playerLeft', (roomData) => {
      gameStore.updateRoomState(roomData)
    })
  }

  const setupGameEvents = () => {
    $socket.on('cardDiscarded', ({ playerId, card }) => {
      console.log('Card discarded:', { playerId, card })
      // 버린 카드를 discard pile에 추가
      gameStore.addToDiscardPile(card)

      // 플레이어 손패 갱신
      if (playerId === gameStore.localPlayerId) {
        gameStore.removeCardFromHand(card.id)
      }

      // 플레이어 손패 수 업데이트
      gameStore.updatePlayerHandCount(playerId)
    })

    $socket.on('cardDrawn', ({ playerId, handCount }) => {
      console.log('Card drawn:', { playerId, handCount })
      // 플레이어의 손패 수 업데이트
      gameStore.updatePlayerHandCount(playerId, handCount)
    })

    $socket.on('cardPlayed', ({ playerId, card, targetPigId, targetPlayerId, effect }) => {
      console.log('Card played:', { playerId, card, effect })
      gameStore.handleCardEffect(effect)
    })

    $socket.on('turnStarted', ({ playerId, turnCount }) => {
      console.log('Turn started:', { playerId, turnCount })
      gameStore.startNewTurn(playerId, turnCount)
    })

    $socket.on('turnEnded', ({ playerId }) => {
      console.log('Turn ended:', { playerId })
      gameStore.endCurrentTurn()
    })
  }

  const clearEvents = (events) => {
    events.forEach(event => $socket.off(event))
  }

  return {
    setupGlobalEvents,
    setupLobbyEvents,
    setupRoomEvents,
    setupGameEvents,
    clearEvents
  }
}