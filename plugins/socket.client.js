// plugins/socket.client.ts
import { io } from 'socket.io-client'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const socket = io(config.public.wsUrl, {
    transports: ['websocket', 'polling'], // polling을 fallback으로 추가
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    forceNew: true,
    path: '/socket.io/',
  })

  // 연결 관리
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id)
  })

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error)
    // 연결 재시도
    setTimeout(() => {
      socket.connect()
    }, 1000)
  })

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason)
    if (reason === 'io server disconnect') {
      // 서버에서 연결을 끊은 경우 재연결 시도
      socket.connect()
    }
  })

  return {
    provide: {
      socket: socket
    }
  }
})