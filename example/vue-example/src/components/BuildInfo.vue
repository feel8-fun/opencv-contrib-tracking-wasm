<script setup>
import { ref, onMounted } from 'vue'
import { cvLoadAuto, cvLoadWASM, cvLoadSIMD } from '@feel8.fun/opencv-contrib-tracking-wasm';
const loadingTime = ref('');
const buildInfo = ref('');

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
    loadingTime.value = `OpenCV loaded in ${dt}ms`;
    buildInfo.value = cvAuto.getBuildInformation();
})

async function onLoadWASM() {
    const t = performance.now();
    cvWASM = await cvLoadWASM();
    const dt = performance.now() - t;
    loadingTime.value=`OpenCV WASM loaded in ${dt}ms`;
    buildInfo.value = cvWASM.getBuildInformation();
}

async function onLoadSIMD() {
    const t = performance.now();
    cvSIMD = await cvLoadSIMD();
    const dt = performance.now() - t;
    loadingTime.value=`OpenCV SIMD loaded in ${dt}ms`;
    buildInfo.value = cvSIMD.getBuildInformation();
}

async function onLoadThreads() {
    loadingTime.value=``;
    buildInfo.value = 'Threads not supported in this build';
    // const t = performance.now();
    // cvThreads = await cvLoadThreads();
    // const dt = performance.now() - t;
    // console.log(`OpenCV Threads loaded in ${dt}ms`);
    // buildInfo.value = cvThreads.getBuildInformation();
}

async function onLoadSIMDThreads() {
    loadingTime.value=``;
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

    <div>{{ loadingTime }}</div>

    <div>{{ buildInfo }}</div>
</template>