script_dir=$(dirname "$(readlink -f "$0")")
branch=4.12.0_wasm_tracking

##################
# Get OpenCV
git clone --branch $branch --depth 1 https://github.com/sis92/opencv.git
git clone --branch $branch --depth 1 https://github.com/sis92/opencv_contrib.git
git clone --depth 1 https://github.com/emscripten-core/emsdk.git

##################
# Get Emscripten
emsdk/emsdk install latest
emsdk/emsdk activate latest
source emsdk/emsdk_env.sh

###################
# Build
emcmake python opencv/platforms/js/build_js.py build_wasm --build_wasm --cmake_option="-DOPENCV_EXTRA_MODULES_PATH=$(pwd)/opencv_contrib/modules" --disable_single_file
cp build_wasm/bin/opencv_js.* ../dist/wasm/

emcmake python opencv/platforms/js/build_js.py build_wasm_simd --build_wasm --cmake_option="-DOPENCV_EXTRA_MODULES_PATH=$(pwd)/opencv_contrib/modules" --disable_single_file --simd
cp build_wasm_simd/bin/opencv_js.* ../dist/wasm_simd/
