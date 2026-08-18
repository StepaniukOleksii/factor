import {describe, expect, it} from 'vitest';
import {formatRecordCount} from './formatRecordCount';

describe('formatRecordCount', () => {
  it.each([
    [0, 'No records'],
    [1, '1 record'],
    [2, '2 records'],
    [12, '12 records'],
  ])('reads %i as "%s"', (count, expected) => {
    expect(formatRecordCount(count)).toBe(expected);
  });
});
