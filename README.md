## Basic Usage

``` js
import { cvLoadAuto } from '@feel8.fun/opencv-contrib-tracking-wasm';

async function main() {
  const cv = await cvLoadAuto();
  console.log("OpenCV.js is ready!");
  // You can now use OpenCV functions here
  console.log(cv.getBuildInformation());
}
```


### Credit

- [opencv-wasm
](https://github.com/echamudi/opencv-wasm)
- [opencv-contrib-wasm](https://github.com/Hpmason/opencv-contrib-wasm/)
- [opencv-js](https://github.com/TechStark/opencv-js)
- [opencv-mobile](https://github.com/nihui/opencv-mobile)