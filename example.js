'use strict';

const {
  createASN1,
  constants: { ASN1_DER_ERROR },
} = require('.');

const asn1 = createASN1();

console.log('asn1 version', asn1.version());
console.log('asn1 print error %s', asn1.strerror(ASN1_DER_ERROR));
console.log('asn1 check_version', asn1.check_version('4.2'));
