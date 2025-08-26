// import { cvWASMPromise, cvSIMDPromise } from './dist/loader.js';
import { cvWASMPromise, cvSIMDPromise } from '@feel8.fun/opencv-contrib-tracking-wasm';

async function main() {

    const t0 = performance.now();
    const cv_wasm = await cvWASMPromise();
    console.log('cv_wasm:', performance.now() - t0);

    const t1 = performance.now();
    const cv_simd = await cvSIMDPromise();
    console.log('cv_simd:', performance.now() - t1);
}

setTimeout(main, 100)
