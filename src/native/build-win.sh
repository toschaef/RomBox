#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
ROOT_DIR="$(dirname $(dirname "$DIR"))"
BIN_DIR="$ROOT_DIR/bin/win"
WORK_DIR="$DIR/.build-win"

SDL2_VERSION="2.32.10"

if ! command -v gcc >/dev/null 2>&1; then
  echo "gcc not found"
  exit 1
fi

mkdir -p "$BIN_DIR"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

if [ ! -d "SDL2-$SDL2_VERSION/x86_64-w64-mingw32" ]; then
  echo "Downloading SDL2 MinGW dev package..."
  curl -kL "https://github.com/libsdl-org/SDL/releases/download/release-$SDL2_VERSION/SDL2-devel-$SDL2_VERSION-mingw.tar.gz" -o sdl2-mingw.tar.gz
  tar xzf sdl2-mingw.tar.gz
  rm -f sdl2-mingw.tar.gz
fi

SDL="$WORK_DIR/SDL2-$SDL2_VERSION/x86_64-w64-mingw32"

echo "Building sdl2probe.exe..."

gcc -O2 -DSDL_MAIN_HANDLED \
  -I"$SDL/include" -I"$SDL/include/SDL2" \
  "$DIR/sdl2probe.c" \
  -L"$SDL/lib" -static \
  -lSDL2 -lm -ldinput8 -ldxguid -ldxerr8 -luser32 -lgdi32 -lwinmm -limm32 -lole32 -loleaut32 -lshell32 -lsetupapi -lversion -luuid \
  -o "$BIN_DIR/sdl2probe.exe"

rm -rf "$WORK_DIR"

echo "Done!"
