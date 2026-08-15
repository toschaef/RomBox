import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import { serialize, deserialize } from 'node:v8';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;
// jsdom does not expose structuredClone; the controls model leans on it heavily.
// v8 serialize/deserialize is the same structured-clone algorithm.
if (typeof global.structuredClone !== 'function') {
  global.structuredClone = (<T>(v: T): T => deserialize(serialize(v)) as T) as typeof global.structuredClone;
}
