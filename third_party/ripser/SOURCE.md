# Ripser source provenance

Bindfly's Stage 13 persistent-homology backend is built from official Ripser:

- Repository: `https://github.com/Ripser/ripser.git`
- Commit: `01add51ff64aaf40889483260cc5c3b7d0f2a1e7`
- License: MIT (`COPYING.txt`)
- Upstream algorithm source is not modified. The reproducible build script copies `ripser.cpp` and injects only `std::cout.precision(std::numeric_limits<value_t>::max_digits10);` at the start of `main` so browser output preserves all digits available from Ripser's `float` filtration values.

Run `tooling/build-ripser-wasm.sh` with Emscripten 3.1.74 to reproduce the checked-in worker module.
