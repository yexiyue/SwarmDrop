#!/bin/bash
set -e

apt-get update -qq
apt-get install -y -qq wget unzip make gcc > /dev/null 2>&1

echo "=== Downloading NDK ==="
cd /tmp
wget -q https://dl.google.com/android/repository/android-ndk-r29-linux.zip
unzip -q android-ndk-r29-linux.zip

export ANDROID_NDK_HOME=/tmp/android-ndk-r29
export NDK_BIN=$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin
export CC=$NDK_BIN/aarch64-linux-android24-clang
export AR=$NDK_BIN/llvm-ar
export RANLIB=$NDK_BIN/llvm-ranlib
export STRIP=$NDK_BIN/llvm-strip
export PATH=$NDK_BIN:$PATH
export CFLAGS="-Os -march=armv8-a+crypto"
export LDFLAGS="-Wl,-z,max-page-size=16384"

echo "=== Configuring libsodium ==="
cd /src
make clean > /dev/null 2>&1 || true
./configure --disable-soname-versions --disable-pie --host=aarch64-linux-android --prefix=/src/libsodium-android-armv8-a --with-sysroot=$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/sysroot > /dev/null 2>&1

echo "=== Building libsodium ==="
make -j$(nproc) install 2>&1

echo "=== Done ==="
ls -la /src/libsodium-android-armv8-a/lib/
