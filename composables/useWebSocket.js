// composables/useWebSocket.js
import { ref, onMounted, onUnmounted } from 'vue'
import { io } from 'socket.io-client'

export const useWebSocket = (url) => {
  const socket = ref(null)
  const isConnected = ref(false)
  const error = ref(null)

  const connect = () => {
    socket.value = io(url, {
      autoConnect: true,
      reconnection: true
    })

    socket.value.on('connect', () => {
      isConnected.value = true
      error.value = null
    })

    socket.value.on('connect_error', (err) => {
      error.value = err
      isConnected.value = false
    })
  }

  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
      isConnected.value = false
    }
  }

  onMounted(() => {
    connect()
  })

  onUnmounted(() => {
    disconnect()
  })

  return {
    socket,
    isConnected,
    error,
    connect,
    disconnect
  }
}