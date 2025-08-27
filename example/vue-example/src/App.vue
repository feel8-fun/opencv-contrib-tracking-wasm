<script setup>
import { cvLoadAuto, cvLoadWASM, cvLoadSIMD } from '@feel8.fun/opencv-contrib-tracking-wasm';
import { onMounted, ref } from 'vue';
const buildInfo = ref('');``

const cvPromise = cvLoadAuto();
let cvAuto;
let cvWASM;
let cvSIMD;
let cvThreads;
let cvSIMDThreads;

onMounted(async () => {
  const t = performance.now();
  cvAuto = await cvPromise;
  const dt = performance.now() - t;
  console.info(cvAuto);
  console.log(`OpenCV loaded in ${dt}ms`);
  buildInfo.value = cvAuto.getBuildInformation();
})

async function onLoadWASM() {
  const t = performance.now();
  cvWASM = await cvLoadWASM();
  const dt = performance.now() - t;
  console.log(`OpenCV WASM loaded in ${dt}ms`);
  buildInfo.value = cvWASM.getBuildInformation();
}

async function onLoadSIMD() {
  const t = performance.now();
  cvSIMD = await cvLoadSIMD();
  const dt = performance.now() - t;
  console.log(`OpenCV SIMD loaded in ${dt}ms`);
  buildInfo.value = cvSIMD.getBuildInformation();
}

async function onLoadThreads() {
  buildInfo.value = 'Threads not supported in this build';
  // const t = performance.now();
  // cvThreads = await cvLoadThreads();
  // const dt = performance.now() - t;
  // console.log(`OpenCV Threads loaded in ${dt}ms`);
  // buildInfo.value = cvThreads.getBuildInformation();
}

async function onLoadSIMDThreads() {
  buildInfo.value = 'Threads not supported in this build';
  // const t = performance.now();
  // cvSIMDThreads = await cvLoadSIMDThreads();
  // const dt = performance.now() - t;
  // console.log(`OpenCV SIMDThreads loaded in ${dt}ms`);
  // buildInfo.value = cvSIMDThreads.getBuildInformation();
}

async function onLoadAuto() {
  const t = performance.now();
  cvAuto = await cvLoadAuto();
  const dt = performance.now() - t;
  console.log(`OpenCV Auto loaded in ${dt}ms`);
  buildInfo.value = cvAuto.getBuildInformation();
}

</script>

<template>
  <button @click="onLoadWASM">LoadWASM</button>
  <button @click="onLoadSIMD">LoadSIMD</button>
  <button @click="onLoadSIMDThreads">LoadSIMDThreads</button>
  <button @click="onLoadThreads">LoadThreads</button>
  <button @click="onLoadAuto">LoadAuto</button>
  <div>{{ buildInfo }}</div>
</template>

<style scoped></style>
