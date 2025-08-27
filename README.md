## Basic Usage

``` js
import cvReadyPromise from "@techstark/opencv-js";

async function main() {
  const cv = await cvReadyPromise;
  console.log("OpenCV.js is ready!");
  // You can now use OpenCV functions here
  console.log(cv.getBuildInformation());
}
```