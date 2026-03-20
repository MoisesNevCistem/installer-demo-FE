import { createRouter, createWebHistory } from 'vue-router'
// import { } from '@/router/guards'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // TODO: AGREGAR RUTAS DE COMPONENTES
    {
      path: '/',
      name: 'pagina-inicial',
      component: () => import('@/modules/MainLayout.vue'),
    }
  ],
})

export default router
