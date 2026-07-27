#!/bin/bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
ROOT_DIR="$(dirname $(dirname "$DIR"))"
BIN_DIR="$ROOT_DIR/bin/mac"

mkdir -p "$BIN_DIR"
cd "$DIR"

if [ ! -d "$BIN_DIR/SDL2.framework" ]; then
  echo "Downloading SDL2 framework..."
  curl -kL https://github.com/libsdl-org/SDL/releases/download/release-2.32.10/SDL2-2.32.10.dmg -o sdl2.dmg
  hdiutil attach sdl2.dmg -mountpoint /Volumes/SDL2 -nobrowse
  cp -R /Volumes/SDL2/SDL2.framework "$BIN_DIR/"
  hdiutil detach /Volumes/SDL2
  rm -f sdl2.dmg
fi

echo "Building sdl2probe-macos..."
clang -O2 sdl2probe.c -I"$BIN_DIR/SDL2.framework/Headers" -F"$BIN_DIR" -framework SDL2 -o "$BIN_DIR/sdl2probe-macos" -rpath @executable_path

if [ ! -d "$BIN_DIR/SDL3.framework" ]; then
  echo "Downloading SDL3 framework..."
  curl -kL https://github.com/libsdl-org/SDL/releases/download/release-3.2.0/SDL3-3.2.0.dmg -o sdl3.dmg
  hdiutil attach sdl3.dmg -mountpoint /Volumes/SDL3 -nobrowse
  cp -R /Volumes/SDL3/SDL3.xcframework/macos-arm64_x86_64/SDL3.framework "$BIN_DIR/"
  hdiutil detach /Volumes/SDL3
  rm -f sdl3.dmg
fi

echo "Building sdl3probe-macos..."
clang -O2 sdl3probe.c -F"$BIN_DIR" -framework SDL3 -o "$BIN_DIR/sdl3probe-macos" -rpath @executable_path

echo "Done!"
