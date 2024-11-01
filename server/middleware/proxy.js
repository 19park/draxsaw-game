// server/middleware/proxy.ts
import { eventHandler, proxyRequest } from 'h3'

export default eventHandler(async (event) => {
  const url = event.path || event.req.url

  if (url?.startsWith('/socket.io')) {
    return proxyRequest(event, 'http://localhost:3001', {
      headers: {
        host: 'localhost:3001',
        'x-forwarded-host': 'localhost:3000',
        'x-forwarded-proto': 'http'
      }
    })
  }
})