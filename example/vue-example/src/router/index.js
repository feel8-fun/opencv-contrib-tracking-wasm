import { createMemoryHistory, createRouter } from 'vue-router'

import BuildInfo from '@/components/BuildInfo.vue';
import OpticalFlow from '@/components/OpticalFlow.vue';
import VideoCapture from '@/components/VideoCapture.vue';
const routes = [
  { path: '/', component: VideoCapture },
  { path: '/buildinfo', component: BuildInfo },
  { path: '/opticalflow', component: OpticalFlow },
  { path: '/videocapture', component: VideoCapture },
]

const router = createRouter({
  history: createMemoryHistory(),
  routes,
})

export default router