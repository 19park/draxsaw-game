import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/socket.io/:pathMatch(.*)*',
      name: 'socket.io',
      // Socket.IO 요청은 라우팅하지 않음
      component: () => null
    }
  ]
})

export default router