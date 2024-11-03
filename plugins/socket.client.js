// plugins/socket.client.ts
import { io } from 'socket.io-client'
import {useGameStore} from "~/composables/useGameStore.js";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const gameStore = useGameStore()

  try {
    const socket = io(config.public.wsUrl, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      path: '/socket.io/',
    })

    socket.on('connect', () => {
      console.log('Socket connected, setting local player ID:', socket.id)
      gameStore.setLocalPlayerId(socket.id)
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      setTimeout(() => {
        socket.connect()
      }, 1000)
    })

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      if (reason === 'io server disconnect') {
        socket.connect()
      }
    })

    socket.on('cardPlayed', (data) => {
      console.log('Card played:', data)
      if (data.effect) {
        gameStore.handleCardEffect(data.effect)
      }
    })

    socket.on('cardDiscarded', (data) => {
      console.log('Card discarded event received:', data)
      gameStore.handleDiscardCard(data)
    })

    socket.on('gameStateUpdated', (newState) => {
      console.log('Game state updated:', newState)
      gameStore.updateGameState(newState)
    })

    return {
      provide: {
        socket
      }
    }
  } catch (error) {
    console.error('Socket initialization error:', error)
    return {
      provide: {
        socket: null
      }
    }
  }
})