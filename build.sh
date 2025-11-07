#!/bin/bash

# Emscripten環境のセットアップ
source ~/emsdk/emsdk_env.sh

# ビルドディレクトリへ移動
cd "$(dirname "$0")"

echo "Building mukuviewer..."

# コンパイル
emcc src/main.cpp src/cipher.cpp \
    -o build/mukuviewer.js \
    -s WASM=1 \
    -s FETCH=1 \
    -s USE_SDL=0 \
    -s EXPORTED_FUNCTIONS='["_main","_initialize","_nextPage","_prevPage","_refresh","_printCacheStatus","_preloadPagesDelayed"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","stringToUTF8","lengthBytesUTF8"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s ENVIRONMENT=web \
    -s MODULARIZE=0 \
    -s EXPORT_NAME='Module' \
    -O2 \
    --bind

if [ $? -eq 0 ]; then
    echo "Build successful!"
    echo "Output files:"
    ls -lh build/
else
    echo "Build failed!"
    exit 1
fi
