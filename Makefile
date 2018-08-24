CFLAGS = -Ivendor/include -O3
EMCC=emcc
libdir=vendor/lib
EXPORTED_FUNCTIONS=export.json
DEPS=$(libdir)/libtasn1.a

libtasn1.js: $(DEPS)
	$(EMCC) \
		$(CFLAGS) \
		-s WASM=1 \
		-s ALLOW_MEMORY_GROWTH=1 \
		-s NO_FILESYSTEM=1 \
		-s EXPORTED_FUNCTIONS="@$(EXPORTED_FUNCTIONS)" \
		-s MODULARIZE=1 \
		-s BINARYEN_ASYNC_COMPILATION=0 \
		-s EXPORTED_RUNTIME_METHODS="[]" \
		-s NO_DYNAMIC_EXECUTION=1 \
		-s TEXTDECODER=0 \
		-s USE_PTHREADS=0 \
		-s ASSERTIONS=0 \
		-s BINARYEN_METHOD='native-wasm' \
		-s TOTAL_MEMORY=1310720 \
		-s TOTAL_STACK=655360 \
		$(DEPS) \
		-o $@

all: libtasn1.js

clean:
	rm -f libtasn1.js libtasn1.wasm
