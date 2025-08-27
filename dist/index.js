import { simd, threads } from "wasm-feature-detect";

const cvLoadWASM = async () => {
    const module = await import("./wasm/opencv.js");
    // OpenCV.js typically exports a default function that returns a promise
    if (typeof module.default === 'function') {
        return await module.default(); // Wait for OpenCV to initialize
    }
    // Or it might export the cv object directly
    return module.cv || module.default || module;
};

const cvLoadSIMD = async () => {
    const module = await import("./wasm_simd/opencv.js");
    if (typeof module.default === 'function') {
        return await module.default();
    }
    return module.cv || module.default || module;
};

const cvLoadSIMDThreads = async () => {
    const module = await import("./wasm_simd/opencv.js");
    if (typeof module.default === 'function') {
        return await module.default();
    }
    return module.cv || module.default || module;
};

const cvLoadThreads = async () => {
    const module = await import("./wasm/opencv.js");
    if (typeof module.default === 'function') {
        return await module.default();
    }
    return module.cv || module.default || module;
};

const cvLoadAuto = async () => {

    let simdSupported = await simd();
    let threadsSupported = await threads();

    if (simdSupported) {
        if (threadsSupported) {
            return cvLoadSIMDThreads();
        } else {
            return cvLoadSIMD();
        }
    } else {
        if (threadsSupported) {
            return cvLoadThreads();
        } else {
            return cvLoadWASM();
        }
    }
};

export { cvLoadWASM, cvLoadSIMD, cvLoadSIMDThreads, cvLoadThreads, cvLoadAuto };