function utf8Bytes(text){let bytes=0;for(const char of text){const value=char.codePointAt(0);bytes+=value<=0x7f?1:value<=0x7ff?2:value<=0xffff?3:4}return bytes}
module.exports={utf8Bytes}
