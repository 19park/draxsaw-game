// server/index.js
import { createServer } from 'node:http'
import { createApp, toNodeListener, eventHandler, setHeader } from 'h3'
import setupWebSocket from './websocket/index.js'

const app = createApp()
const httpServer = createServer(toNodeListener(app))

// CORS 설정 개선
app.use('*', eventHandler(async (event) => {
  // CORS preflight 요청 처리
  if (event.method === 'OPTIONS') {
    setHeader(event, 'Access-Control-Allow-Origin', 'http://localhost:3000')
    setHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')
    setHeader(event, 'Access-Control-Allow-Credentials', 'true')
    setHeader(event, 'Access-Control-Max-Age', '86400')
    return null
  }

  // 일반 요청에 대한 CORS 헤더
  setHeader(event, 'Access-Control-Allow-Origin', 'http://localhost:3000')
  setHeader(event, 'Access-Control-Allow-Credentials', 'true')
}))

const io = setupWebSocket(httpServer)

const port = process.env.PORT || 3001
httpServer.listen(port, () => {
  console.log(`WebSocket Server is running on port ${port}`)
})

export default app