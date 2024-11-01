// composables/useSocketStatus.ts
import { ref, onMounted, onUnmounted } from 'vue'

export function useSocketStatus() {
  const isConnected = ref(false)
  const connectionError = ref(null)
  const reconnectAttempts = ref(0)
  const { $socket } = useNuxtApp()

  const checkConnection = () => {
    $socket.emit('ping')
  }

  const setupSocketListeners = () => {
    $socket.on('connect', () => {
      console.log('Socket connected')
      isConnected.value = true
      connectionError.value = null
      reconnectAttempts.value = 0
    })

    $socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      isConnected.value = false
    })

    $socket.on('connect_error', (error) => {
      console.error('Connection error:', error)
      isConnected.value = false
      connectionError.value = error.message
      reconnectAttempts.value++
    })

    $socket.on('pong', () => {
      isConnected.value = true
    })
  }

  // 주기적으로 연결 상태 확인
  let connectionCheck
  onMounted(() => {
    setupSocketListeners()
    connectionCheck = setInterval(checkConnection, 5000)
  })

  onUnmounted(() => {
    if (connectionCheck) clearInterval(connectionCheck)
    $socket.off('connect')
    $socket.off('disconnect')
    $socket.off('connect_error')
    $socket.off('pong')
  })

  return {
    isConnected,
    connectionError,
    reconnectAttempts
  }
}