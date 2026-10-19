/// <reference types="jest" />

import { bucketStatus, toCad } from './budget';

describe('bucketStatus', () => {
  it('treats needs as a ceiling', () => {
    expect(bucketStatus('needs', 0.549, 0.55)).toBe('Within limit');
    expect(bucketStatus('needs', 0.55, 0.55)).toBe('Within limit');
    expect(bucketStatus('needs', 0.56, 0.55)).toBe('Over limit');
  });

  it('treats investment and emergency as floors', () => {
    expect(bucketStatus('investment', 0.25, 0.25)).toBe('On target');
    expect(bucketStatus('investment', 0.3, 0.25)).toBe('On target');
    expect(bucketStatus('investment', 0.2, 0.25)).toBe('Below target');
    expect(bucketStatus('emergency', 0.2, 0.2)).toBe('On target');
    expect(bucketStatus('emergency', 0.19, 0.2)).toBe('Below target');
  });
});

describe('toCad', () => {
  it('keeps Canadian dollars', () => {
    expect(toCad(100, 'CAD', 940.29)).toBe(100);
    expect(toCad(10.126, 'CAD', 1)).toBe(10.13);
  });

  it('converts naira at the given rate', () => {
    expect(toCad(50000, 'NGN', 940.29)).toBe(53.18);
  });

  it('rejects a missing naira rate', () => {
    expect(() => toCad(50000, 'NGN', 0)).toThrow('Exchange rate must be greater than zero');
  });
});
