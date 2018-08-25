#include "libtasn1.h"
#include "emscripten.h"

#ifdef __cplusplus
extern "C"
{
#endif

int EMSCRIPTEN_KEEPALIVE node_asn1_length_der(unsigned long int len, unsigned char *der) {
  int der_len = 0;

  asn1_length_der(len, der, &der_len);
  return der_len;
}

int EMSCRIPTEN_KEEPALIVE node_asn1_octet_der(const unsigned char * str, int str_len, unsigned char * der) {
  int der_len = 0;
  asn1_octet_der(str, str_len, der, &der_len);

  return der_len;
}

int EMSCRIPTEN_KEEPALIVE node_asn1_bit_der(const unsigned char * str, int bit_len, unsigned char * der) {
  int der_len = 0;
  asn1_bit_der(str, bit_len, der, &der_len);
  return der_len;
}

#ifdef __cplusplus
}
#endif
