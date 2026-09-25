#!/usr/bin/env bash
set -euo pipefail

readonly RIPSER_COMMIT='01add51ff64aaf40889483260cc5c3b7d0f2a1e7'
readonly EMSCRIPTEN_VERSION='3.1.74'
readonly EXPECTED_SHA256='0165efd5f9d299fb114621f68d1c4b9d7f8a01647ab54f6a282896f1daed4851'

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_path="${1:-$repo_root/apps/studio/src/vendor/ripser-wasm.generated.mjs}"
emxx="${EMXX:-em++}"

compiler_version="$($emxx --version | head -n 1)"
if [[ "$compiler_version" != *" $EMSCRIPTEN_VERSION "* ]]; then
	echo "Expected Emscripten $EMSCRIPTEN_VERSION, got: $compiler_version" >&2
	exit 1
fi

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/bindfly-ripser-build.XXXXXX")"
trap 'rm -rf "$work_dir"' EXIT
source_dir="$work_dir/ripser"
mkdir -p "$source_dir"
git -C "$source_dir" init -q
git -C "$source_dir" remote add origin https://github.com/Ripser/ripser.git
git -C "$source_dir" fetch -q --depth 1 origin "$RIPSER_COMMIT"
git -C "$source_dir" checkout -q --detach FETCH_HEAD

actual_commit="$(git -C "$source_dir" rev-parse HEAD)"
if [[ "$actual_commit" != "$RIPSER_COMMIT" ]]; then
	echo "Ripser checkout mismatch: expected $RIPSER_COMMIT, got $actual_commit" >&2
	exit 1
fi

build_source="$work_dir/ripser-bindfly.cpp"
cp "$source_dir/ripser.cpp" "$build_source"
python3 - "$build_source" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text()
needle = 'int main(int argc, char** argv) {\n'
if source.count(needle) != 1:
    raise SystemExit('Ripser main signature changed; precision patch cannot be applied safely.')
source = source.replace(
    needle,
    needle + '\tstd::cout.precision(std::numeric_limits<value_t>::max_digits10);\n',
    1,
)
path.write_text(source)
PY

mkdir -p "$(dirname "$output_path")"
"$emxx" "$build_source" \
	-o "$output_path" \
	-O3 -std=c++11 -D NDEBUG \
	-sMODULARIZE=1 \
	-sEXPORT_ES6=1 \
	-sSINGLE_FILE=1 \
	-sENVIRONMENT=worker \
	-sINVOKE_RUN=0 \
	-sEXIT_RUNTIME=1 \
	-sFORCE_FILESYSTEM=1 \
	-sALLOW_MEMORY_GROWTH=1 \
	-sMAXIMUM_MEMORY=268435456 \
	-sEXPORTED_RUNTIME_METHODS='["FS","callMain"]'

actual_sha256="$(shasum -a 256 "$output_path" | awk '{print $1}')"
if [[ "$actual_sha256" != "$EXPECTED_SHA256" ]]; then
	echo "Generated Ripser WASM checksum mismatch: expected $EXPECTED_SHA256, got $actual_sha256" >&2
	exit 1
fi

echo "Built $output_path"
echo "Ripser $RIPSER_COMMIT · Emscripten $EMSCRIPTEN_VERSION · SHA-256 $actual_sha256"
