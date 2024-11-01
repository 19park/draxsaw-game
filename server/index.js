// server/index.js
import { createServer } from 'node:http'
import { createApp, toNodeListener, eventHandler, setHeader } from 'h3'
import setupWebSocket from './websocket/index.js'

const app = createApp()
const httpServer = createServer(toNodeListener(app))

// CORS 미들웨어
app.use('*', eventHandler((event) => {
  setHeader(event, 'Access-Control-Allow-Origin', 'http://localhost:3000')
  setHeader(event, 'Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')
  setHeader(event, 'Access-Control-Allow-Credentials', 'true')
}))

const io = setupWebSocket(httpServer)

const port = process.env.PORT || 3001
httpServer.listen(port, () => {
  console.log(`WebSocket Server is running on port ${port}`)
})

export default app