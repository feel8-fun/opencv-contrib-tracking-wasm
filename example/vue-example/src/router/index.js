import { createWebHistory, createRouter } from 'vue-router'

import BuildInfo from '@/components/BuildInfo.vue';
import OpticalFlow from '@/components/OpticalFlow.vue';
import VideoCapture from '@/components/VideoCapture.vue';
import Trackers from '@/components/Trackers.vue';
const routes = [
  { path: '/', component: Trackers },
  { path: '/buildinfo', component: BuildInfo },
  { path: '/opticalflow', component: OpticalFlow },
  { path: '/videocapture', component: VideoCapture },
  { path: '/trackers', component: Trackers },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router