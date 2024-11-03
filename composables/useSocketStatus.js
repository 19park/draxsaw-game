// composables/useSocketStatus.js
import { ref, onMounted, onUnmounted } from 'vue'

export function useSocketStatus() {
  const { $socket } = useNuxtApp()
  const status = ref('disconnected')
  const error = ref(null)

  const setupSocketListeners = () => {
    if (!$socket) return

    $socket.on('connect', () => {
      status.value = 'connected'
      error.value = null
    })

    $socket.on('disconnect', (reason) => {
      status.value = 'disconnected'
      console.log('Socket disconnected:', reason)
    })

    $socket.on('connect_error', (err) => {
      status.value = 'error'
      error.value = err.message
      console.error('Connection error:', err)
    })
  }

  const clearSocketListeners = () => {
    if (!$socket) return

    $socket.off('connect')
    $socket.off('disconnect')
    $socket.off('connect_error')
  }

  return {
    status,
    error,
    setupSocketListeners,
    clearSocketListeners
  }
}