'use strict';

const fs = require('fs');
const path = require('path');
const emscripten = require('./libtasn1');

const binary = fs.readFileSync(path.join(__dirname, 'libtasn1.wasm'));

const _module = Symbol('module');

const ASN1_MAX_TAG_SIZE = 4;
const ASN1_MAX_LENGTH_SIZE = 9;
const ASN1_MAX_TL_SIZE = ASN1_MAX_TAG_SIZE + ASN1_MAX_LENGTH_SIZE;
const ASN1_SUCCESS = 0;

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
 * Check if value is a number.
 * @param {*} value
 */
function assertint(value) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError('Expected number');
  }
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
   * Creates the DER encoding of the provided length value.
   * @param {number} length value to convert.
   * @param {number} der buffer to hold the returned encoding (may be NULL).
   * @returns {number} number of meaningful bytes of ANS (der[0]..der[der_len-1]).
   */
  length_der(length, der) {
    assertint(length);

    if (!Number.isSafeInteger(der) && der !== null) {
      throw new TypeError('Invalid argument "der"');
    }

    if (der === null) {
      return this[_module]._node_asn1_length_der(length, 0);
    }

    return this[_module]._node_asn1_length_der(length, der);
  }

  /**
   * Creates a length-value DER encoding for the input data.
   * The DER encoding of the input data will be placed in the der variable.
   *
   * Note that the OCTET STRING tag is not included in the output.
   * @param {string} str the input data.
   * @param {number} der buffer to hold the returned encoded string.
   * @param {string} [encoding] valid nodejs string encoding.
   * @returns {number} number of meaningful bytes of DER
   */
  octet_der(str, der, encoding = 'ascii') {
    assertint(der);

    const input_ptr = this.salloc(str, encoding);
    const input_length = Buffer.byteLength(str, encoding);

    const length = this[_module]._node_asn1_octet_der(
      input_ptr,
      input_length,
      der
    );
    this.free(input_ptr);

    return length;
  }

  /**
   * Creates the DER encoding for various simple ASN.1 types like strings etc.
   * The complete DER encoding should consist of the value in tl appended with the provided str .
   * @param {number} etype The type of the string to be encoded (ASN1_ETYPE_)
   * @param {string} str the string data.
   * @param {string} [encoding] valid nodejs string encoding.
   * @returns {[Buffer, number]} the encoded tag with length; ASN1_SUCCESS if successful or an error value.
   */
  encode_simple_der(etype, str, encoding = 'ascii') {
    assertint(etype);

    const in_ptr = this.salloc(str, encoding);
    const in_length = Buffer.byteLength(str, encoding);

    const out_tl = this.malloc(ASN1_MAX_TL_SIZE);
    const out_tl_size = this.malloc(ASN1_MAX_TAG_SIZE); // size of int, 4 in wasm32
    const ret = this[_module]._asn1_encode_simple_der(
      etype,
      in_ptr,
      in_length,
      out_tl,
      out_tl_size
    );

    const tl_size = Buffer.from(
      this.memory.buffer,
      out_tl_size,
      ASN1_MAX_TAG_SIZE
    ).readUInt32BE(0);
    const view_tl = Buffer.from(this.memory.buffer, out_tl, tl_size);
    const tl = Buffer.from(view_tl); // copy data wasm -> node

    this.free(in_ptr);
    this.free(out_tl);
    this.free(out_tl_size);

    return [tl, ret];
  }

  /**
   * Creates a length-value DER encoding for the input data as
   * it would have been for a BIT STRING. The DER encoded data
   * will be copied in der.
   *
   * Note that the BIT STRING tag is not included in the output.
   * @param {Buffer} bitstr BIT string.
   * @param {number} der buffer to hold the returned encoded string.
   * @returns {number} number of meaningful bytes of DER
   */
  bit_der(bitstr, der) {
    assertint(der);

    if (!Buffer.isBuffer(bitstr)) {
      throw new TypeError('Expected Buffer');
    }

    const input_ptr = this.salloc(bitstr);
    const input_length = bitstr.length;

    const length = this[_module]._node_asn1_bit_der(
      input_ptr,
      input_length,
      der
    );
    this.free(input_ptr);

    return length;
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

    const mem = this.salloc(version);
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
   * Alloc memory for a string
   * @param {Buffer|string} data
   * @param {string} encoding
   * @returns {number}
   */
  salloc(data, encoding = 'ascii') {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, encoding);
    const mem = this[_module]._malloc(buf.length);

    this[_module].HEAPU8.set(buf, mem);
    return mem;
  }

  /**
   * Alloc {bytes} bytes in wasm memory
   * @param {number} bytes
   * @returns {number} pointer to allocated memory
   */
  malloc(bytes) {
    return this[_module]._malloc(bytes);
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
  ASN1_MAX_TL_SIZE,
  ASN1_MAX_TAG_SIZE,
  ASN1_MAX_LENGTH_SIZE,

  /**
   * Errors returned by libtasn1 functions.
   */
  ASN1_SUCCESS,
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

  /**
   * List of constants for field type of node_asn
   */
  ASN1_ETYPE_INVALID: 0,
  ASN1_ETYPE_CONSTANT: 1,
  ASN1_ETYPE_IDENTIFIER: 2,
  ASN1_ETYPE_INTEGER: 3,
  ASN1_ETYPE_BOOLEAN: 4,
  ASN1_ETYPE_SEQUENCE: 5,
  ASN1_ETYPE_BIT_STRING: 6,
  ASN1_ETYPE_OCTET_STRING: 7,
  ASN1_ETYPE_TAG: 8,
  ASN1_ETYPE_DEFAULT: 9,
  ASN1_ETYPE_SIZE: 10,
  ASN1_ETYPE_SEQUENCE_OF: 11,
  ASN1_ETYPE_OBJECT_ID: 12,
  ASN1_ETYPE_ANY: 13,
  ASN1_ETYPE_SET: 14,
  ASN1_ETYPE_SET_OF: 15,
  ASN1_ETYPE_DEFINITIONS: 16,
  ASN1_ETYPE_CHOICE: 18,
  ASN1_ETYPE_IMPORTS: 19,
  ASN1_ETYPE_NULL: 20,
  ASN1_ETYPE_ENUMERATED: 21,
  ASN1_ETYPE_GENERALSTRING: 27,
  ASN1_ETYPE_NUMERIC_STRING: 28,
  ASN1_ETYPE_IA5_STRING: 29,
  ASN1_ETYPE_TELETEX_STRING: 30,
  ASN1_ETYPE_PRINTABLE_STRING: 31,
  ASN1_ETYPE_UNIVERSAL_STRING: 32,
  ASN1_ETYPE_BMP_STRING: 33,
  ASN1_ETYPE_UTF8_STRING: 34,
  ASN1_ETYPE_VISIBLE_STRING: 35,
  ASN1_ETYPE_UTC_TIME: 36,
  ASN1_ETYPE_GENERALIZED_TIME: 37,
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
