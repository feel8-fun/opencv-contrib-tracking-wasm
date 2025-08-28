import { createMemoryHistory, createRouter } from 'vue-router'

import BuildInfo from '../components/BuildInfo.vue'

const routes = [
  { path: '/', component: BuildInfo },
]

const router = createRouter({
  history: createMemoryHistory(),
  routes,
})

export default router