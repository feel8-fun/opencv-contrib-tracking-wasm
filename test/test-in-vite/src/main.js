// Test different import styles to verify CJS → ESM conversion

console.log('🧪 Testing CJS package in ESM/Vite environment...')

// 1. Default import (most common with CJS)
import cvReadyPromise from '@feel8.fun/opencv-contrib-tracking-wasm'
// const cvReadyPromise = import('@feel8.fun/opencv-contrib-tracking-wasm')

async function test() {
  console.log(cvReadyPromise)
  const cv = await cvReadyPromise;
  console.log(cv);

  document.querySelector('#app').textContent = cv.getBuildInformation();
}

test();

// // 2. Named imports (if your CJS package supports them)
// try {
//   import { myFunction, myConstant } from '@feel8.fun/opencv-contrib-tracking-wasm'
//   console.log('Named imports work:', { myFunction: myFunction(), myConstant })
// } catch (error) {
//   console.log('Named imports not available:', error.message)
// }

// // 3. Mixed import
// try {
//   import defaultExport, { myFunction } from '@feel8.fun/opencv-contrib-tracking-wasm'
//   console.log('Mixed import works:', { default: defaultExport, named: myFunction() })
// } catch (error) {
//   console.log('Mixed import not available:', error.message)
// }

// // 4. Dynamic import (always works)
// const dynamicImport = await import('@feel8.fun/opencv-contrib-tracking-wasm')
// console.log('Dynamic import:', dynamicImport)

// // 5. Access via default export
// console.log('Via default.myFunction:', cjsPackage.myFunction())
// console.log('Via default.myConstant:', cjsPackage.myConstant)

// // Test your actual package functionality
// console.log('✅ Package functions correctly in Vite!')