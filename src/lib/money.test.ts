/// <reference types="jest" />

import { formatCAD, formatCADWhole, formatNGN, formatPercent } from './money';

describe('money formatting', () => {
  it('formats Canadian dollars, including negatives and whole amounts', () => {
    expect(formatCAD(1350)).toBe('$1,350.00');
    expect(formatCAD(0)).toBe('$0.00');
    expect(formatCAD(-42.5)).toBe('−$42.50');
    expect(formatCADWhole(1350)).toBe('$1,350');
    expect(formatCADWhole(-1350)).toBe('−$1,350');
  });

  it('formats naira and percentages', () => {
    expect(formatNGN(940.29)).toBe('₦940.29');
    expect(formatNGN(-10)).toBe('−₦10.00');
    expect(formatPercent(0.55)).toBe('55.0%');
    expect(formatPercent(0.35, 0)).toBe('35%');
  });
});
