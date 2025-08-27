import { simd } from "wasm-feature-detect";
const simdSupported = await simd();

const cvLoadWASM = async () => {
    const module = await import("./build_wasm_single/opencv.js");
    // OpenCV.js typically exports a default function that returns a promise
    if (typeof module.default === 'function') {
        return await module.default(); // Wait for OpenCV to initialize
    }
    // Or it might export the cv object directly
    return module.cv || module.default || module;
};

const cvLoadSIMD = async () => {
    const module = await import("./build_simd_single/opencv.js");
    if (typeof module.default === 'function') {
        return await module.default();
    }
    return module.cv || module.default || module;
};

// const cvLoadSIMDThreads = async () => {
//     const module = await import("./build_simd_threads_single/opencv.js");
//     if (typeof module.default === 'function') {
//         return await module.default();
//     }
//     return module.cv || module.default || module;
// };

// const cvLoadThreads = async () => {
//     const module = await import("./build_threads_single/opencv.js");
//     if (typeof module.default === 'function') {
//         return await module.default();
//     }
//     return module.cv || module.default || module;
// };

const cvLoadAuto = async () => {
    if (simdSupported) {
        return cvLoadSIMD();
    } else {
        return cvLoadWASM();
    }
};

export { cvLoadWASM, cvLoadSIMD, cvLoadAuto };