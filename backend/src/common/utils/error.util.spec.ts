import { errorMessage, errorStack } from './error.util';
describe('caught error accessors', () => {
  it('[BE-UTIL-001] formats Error, string, object, null and undefined safely', () => {
    const error = new Error('specific failure');
    expect(errorMessage(error)).toBe('specific failure');
    expect(errorStack(error)).toBe(error.stack);
    expect(errorMessage('failure')).toBe('failure');
    expect(errorMessage({ message: 'details' })).toBe('{"message":"details"}');
    expect(errorMessage(null)).toBe('null');
    expect(errorMessage(undefined)).toBe('undefined');
    expect(errorMessage(1n)).toBe('1');
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(errorMessage(circular)).toBe('[object Object]');
    for (const value of ['failure', {}, undefined]) {
      expect(errorStack(value)).toBeUndefined();
    }
  });
});
