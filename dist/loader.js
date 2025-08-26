async function cvWASMPromise() {
    const cvReadyPromise = import('./wasm/opencv_js.js')
    return cvReadyPromise
}

async function cvSIMDPromise() {
    const cvReadyPromise = import('./wasm_simd/opencv_js.js')
    return cvReadyPromise
}

export { cvWASMPromise, cvSIMDPromise }