script_dir=$(dirname "$(readlink -f "$0")")
branch=4.12.0_wasm_tracking

##################
# Get OpenCV
git clone --branch $branch --depth 1 https://github.com/feel8-fun/opencv.git
git clone --branch $branch --depth 1 https://github.com/feel8-fun/opencv_contrib.git
git clone --depth 1 https://github.com/emscripten-core/emsdk.git

##################
# Get Emscripten
emsdk/emsdk install latest
emsdk/emsdk activate latest
source emsdk/emsdk_env.sh

###################
# Build
patch_path=var_module.patch

emcmake python opencv/platforms/js/build_js.py build_wasm --build_wasm --cmake_option="-DOPENCV_EXTRA_MODULES_PATH=$script_dir/opencv_contrib/modules"
mkdir -p ../dist/wasm/
cp build_wasm/bin/opencv.js ../dist/wasm/
patch ../dist/wasm/opencv.js < $patch_path --no-backup-if-mismatch

emcmake python opencv/platforms/js/build_js.py build_wasm_simd --build_wasm --cmake_option="-DOPENCV_EXTRA_MODULES_PATH=$script_dir/opencv_contrib/modules" --simd
mkdir -p ../dist/wasm_simd/
cp build_wasm_simd/bin/opencv.js ../dist/wasm_simd/
patch ../dist/wasm_simd/opencv.js < $patch_path --no-backup-if-mismatch
