import { describe, it, expect } from 'vitest'
import { safeParseInt, safeParseFloat } from '@/lib/utils/safe-parse'

describe('safeParseInt', () => {
  it('returns default value when input is null', () => {
    expect(safeParseInt(null, 20)).toBe(20)
  })

  it('returns default value when input is empty string', () => {
    expect(safeParseInt('', 20)).toBe(20)
  })

  it('parses valid integer string', () => {
    expect(safeParseInt('10', 20)).toBe(10)
  })

  it('returns default value when input is NaN string', () => {
    expect(safeParseInt('abc', 20)).toBe(20)
  })

  it('clamps negative value to min', () => {
    expect(safeParseInt('-5', 20, 0, 100)).toBe(0)
  })

  it('clamps value exceeding max', () => {
    expect(safeParseInt('9999', 20, 0, 100)).toBe(100)
  })

  it('allows value at exactly min boundary', () => {
    expect(safeParseInt('0', 20, 0, 100)).toBe(0)
  })

  it('allows value at exactly max boundary', () => {
    expect(safeParseInt('100', 20, 0, 100)).toBe(100)
  })

  it('uses default min=0 and max=1000', () => {
    expect(safeParseInt('500', 20)).toBe(500)
    expect(safeParseInt('-1', 20)).toBe(0)
    expect(safeParseInt('1001', 20)).toBe(1000)
  })

  it('handles custom min/max range', () => {
    expect(safeParseInt('5', 10, 1, 50)).toBe(5)
    expect(safeParseInt('0', 10, 1, 50)).toBe(1)
    expect(safeParseInt('51', 10, 1, 50)).toBe(50)
  })

  it('handles floating point string by truncating', () => {
    expect(safeParseInt('3.7', 20)).toBe(3)
  })
})

describe('safeParseFloat', () => {
  it('returns 0 for null', () => {
    expect(safeParseFloat(null)).toBe(0)
  })

  it('returns 0 for undefined', () => {
    expect(safeParseFloat(undefined)).toBe(0)
  })

  it('parses valid number', () => {
    expect(safeParseFloat(42.5)).toBe(42.5)
  })

  it('parses valid string number', () => {
    expect(safeParseFloat('3.14')).toBe(3.14)
  })

  it('returns default for NaN input', () => {
    expect(safeParseFloat('abc')).toBe(0)
    expect(safeParseFloat(NaN)).toBe(0)
  })

  it('returns default for Infinity', () => {
    expect(safeParseFloat(Infinity)).toBe(0)
    expect(safeParseFloat(-Infinity)).toBe(0)
  })

  it('returns custom default value on NaN', () => {
    expect(safeParseFloat('abc', 99)).toBe(99)
  })

  it('returns 0 for null even with custom default (Number(null) === 0)', () => {
    // Number(null) === 0, which is finite, so returns 0 not the default
    expect(safeParseFloat(null, 5)).toBe(0)
  })

  it('handles zero correctly', () => {
    expect(safeParseFloat(0)).toBe(0)
    expect(safeParseFloat('0')).toBe(0)
  })

  it('handles negative numbers', () => {
    expect(safeParseFloat(-7.5)).toBe(-7.5)
    expect(safeParseFloat('-3.2')).toBe(-3.2)
  })
})
