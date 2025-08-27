script_dir=$(dirname "$(readlink -f "$0")")
branch=4.12.0_wasm_tracking

##################
# Get OpenCV
if [ ! -d "opencv" ]; then
  git clone --branch $branch --depth 1 https://github.com/feel8-fun/opencv.git
fi
if [ ! -d "opencv_contrib" ]; then
  git clone --branch $branch --depth 1 https://github.com/feel8-fun/opencv_contrib.git
fi

EMSDK_DOCKER="emscripten/emsdk:latest"

function docker_build()
{
    cmd=(python3 /src/opencv/platforms/js/build_js.py --cmake_option="-DOPENCV_EXTRA_MODULES_PATH=/src/opencv_contrib/modules" $@)
    docker run --rm -v "$script_dir":/src -u $(id -u):$(id -g) $EMSDK_DOCKER "${cmd[@]}"
}

target_list=(
  build_wasm_single
  build_simd_single
  # build_simd_threads_single
  # build_threads_single
)

# docker_build build_wasm --build_wasm --disable_single_file
# docker_build build_simd --build_wasm --simd --disable_single_file
docker_build build_wasm_single --build_wasm
docker_build build_simd_single --build_wasm --simd
# docker_build build_simd_threads_single --build_wasm --simd --threads
# docker_build build_threads_single --build_wasm --simd --threads

function apply_patch()
{
  patch $1 < var_module.patch --no-backup-if-mismatch
}

for i in "${target_list[@]}";
do
  mkdir -p ../dist/$i
  cp $i/bin/opencv.js ../dist/$i/opencv.js
  apply_patch ../dist/$i/opencv.js

  if [ -f $i/bin/opencv_js.wasm ]; then
    cp $i/bin/opencv_js.wasm ../dist/$i/opencv_js.wasm
  fi
done



########################
# DEBUGGING
#######################
# git clone --depth 1 https://github.com/emscripten-core/emsdk.git
# emsdk/emsdk install latest
# emsdk/emsdk activate latest
# source emsdk/emsdk_env.sh

# emcmake python opencv/platforms/js/build_js.py build_wasm --build_wasm --cmake_option="-DOPENCV_EXTRA_MODULES_PATH=$script_dir/opencv_contrib/modules"
# mkdir -p ../dist/wasm/
# cp build_wasm/bin/opencv.js ../dist/wasm/
# apply_patch ../dist/wasm/opencv.js 

# emcmake python opencv/platforms/js/build_js.py build_wasm_simd --build_wasm --cmake_option="-DOPENCV_EXTRA_MODULES_PATH=$script_dir/opencv_contrib/modules" --simd
# mkdir -p ../dist/wasm_simd/
# cp build_wasm_simd/bin/opencv.js ../dist/wasm_simd/
# apply_patch ../dist/wasm_simd/opencv.js
