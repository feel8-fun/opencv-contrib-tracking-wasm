import { createMemoryHistory, createRouter } from 'vue-router'

import BuildInfo from '@/components/BuildInfo.vue';
import OpticalFlow from '@/components/OpticalFlow.vue';

const routes = [
  { path: '/', component: OpticalFlow },
  { path: '/buildinfo', component: BuildInfo },
  { path: '/opticalflow', component: OpticalFlow },
]

const router = createRouter({
  history: createMemoryHistory(),
  routes,
})

export default router