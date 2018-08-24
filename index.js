'use strict';

const fs = require('fs');
const path = require('path');
const emscripten = require('./libtasn1');

const binary = fs.readFileSync(path.join(__dirname, 'libtasn1.wasm'));

const _module = Symbol('module');

/**
 * Create new instance of WASM module.
 * @returns {object}
 */
function createModule() {
  return emscripten({ wasmBinary: binary });
}

/**
 * Print pointer from WebAssembly Memory
 * @param {WebAssembly.memory} memory
 * @param {number} ptr
 * @param {string} [encoding]
 * @returns {string}
 */
function pointer2string(memory, ptr, encoding = 'ascii') {
  const view = Buffer.from(memory.buffer, ptr);
  let end = 0;

  while (end < view.length) {
    if (view[end] === 0) {
      break;
    }

    end += 1;
  }

  if (end === view.length) {
    throw new Error(`Not found \0 symbol since ${ptr} byte.`);
  }

  return view.toString(encoding, 0, end);
}

/**
 * Libtasn1 instance.
 */
class Libtasn1 {
  /**
   * @constructor
   */
  constructor() {
    this[_module] = createModule();
  }

  /**
   * Check that the version of the library is at minimum
   * the requested one and return the version string;
   * return NULL if the condition is not satisfied.
   *
   * See ASN1_VERSION for a suitable version string.
   * @param {string} [version] required version number
   * @returns {string|null}
   */
  check_version(version) {
    if (typeof version !== 'string') {
      throw new TypeError('Expected string');
    }

    const mem = this.malloc(version);
    const ptr = this[_module]._asn1_check_version(mem);
    this.free(mem);

    if (ptr === 0) {
      return null;
    }

    return pointer2string(this.memory, ptr);
  }

  /**
   * Returns a string with a description of an error.
   * This function is similar to strerror. The only difference
   * is that it accepts an error (number) returned by a libtasn1 function.
   * @param {number} errcode is an error returned by a libtasn1 function.
   * @returns {string} string describing error code.
   */
  strerror(errcode) {
    if (typeof errcode !== 'number') {
      throw new TypeError('Expected Number.');
    }

    const ptr = this[_module]._asn1_strerror(errcode);

    if (ptr === 0) {
      throw new Error('Invalid error code');
    }

    return pointer2string(this.memory, ptr);
  }

  /**
   * Get library version.
   * @returns {string}
   */
  version() {
    const ptr = this[_module]._asn1_check_version(0);

    return pointer2string(this.memory, ptr);
  }

  /**
   * Alloc memory and write string
   * @param {Buffer|string} data
   * @param {string} enc
   * @returns {number}
   */
  malloc(data, enc = 'ascii') {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, enc);
    const mem = this[_module]._malloc(buf.length);

    this[_module].HEAPU8.set(buf, mem);
    return mem;
  }

  /**
   * Free memory
   * @param {number} ptr
   */
  free(ptr) {
    this[_module]._free(ptr);
  }

  /**
   * @returns {object}
   */
  get memory() {
    return this[_module].wasmMemory;
  }
}

/**
 * Creates instance of Libtasn1.
 * @returns {Libtasn1}
 */
function createASN1() {
  return new Libtasn1();
}

const constants = {
  /**
   * Errors returned by libtasn1 functions.
   */
  ASN1_SUCCESS: 0,
  ASN1_FILE_NOT_FOUND: 1,
  ASN1_ELEMENT_NOT_FOUND: 2,
  ASN1_IDENTIFIER_NOT_FOUND: 3,
  ASN1_DER_ERROR: 4,
  ASN1_VALUE_NOT_FOUND: 5,
  ASN1_GENERIC_ERROR: 6,
  ASN1_VALUE_NOT_VALID: 7,
  ASN1_TAG_ERROR: 8,
  ASN1_TAG_IMPLICIT: 9,
  ASN1_ERROR_TYPE_ANY: 10,
  ASN1_SYNTAX_ERROR: 11,
  ASN1_MEM_ERROR: 12,
  ASN1_MEM_ALLOC_ERROR: 13,
  ASN1_DER_OVERFLOW: 14,
  ASN1_NAME_TOO_LONG: 15,
  ASN1_ARRAY_ERROR: 16,
  ASN1_ELEMENT_NOT_EMPTY: 17,
  ASN1_TIME_ENCODING_ERROR: 18,
};

module.exports = {
  createASN1,
  Libtasn1,
  constants,
  utils: {
    createModule,
    pointer2string,
  },
};
