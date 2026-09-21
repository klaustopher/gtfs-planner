import { describe, it, expect } from 'vitest'
import { getContrastTextColor } from './colorContrast'

const BLACK = '#000000'
const WHITE = '#FFFFFF'

describe('getContrastTextColor', () => {
  it('puts black text on light backgrounds and white text on dark ones', () => {
    expect(getContrastTextColor('#FFFFFF')).toBe(BLACK)
    expect(getContrastTextColor('#000000')).toBe(WHITE)
  })

  it('weights the channels by luminance rather than treating them equally', () => {
    expect(getContrastTextColor('#00FF00')).toBe(BLACK)
    expect(getContrastTextColor('#FF0000')).toBe(WHITE)
    expect(getContrastTextColor('#0000FF')).toBe(WHITE)
  })

  it('treats mid grey as a dark background, since the threshold is luminance not lightness', () => {
    expect(getContrastTextColor('#808080')).toBe(WHITE)
  })

  it('accepts colors with or without a leading hash', () => {
    expect(getContrastTextColor('FFFFFF')).toBe(BLACK)
    expect(getContrastTextColor('#FFFFFF')).toBe(BLACK)
  })

  it('expands three-digit hex codes', () => {
    expect(getContrastTextColor('#fff')).toBe(BLACK)
    expect(getContrastTextColor('#000')).toBe(WHITE)
    expect(getContrastTextColor('#0f0')).toBe(getContrastTextColor('#00ff00'))
  })

  it('is case insensitive', () => {
    expect(getContrastTextColor('#abcdef')).toBe(getContrastTextColor('#ABCDEF'))
  })

  it('falls back to white text when the color cannot be parsed', () => {
    for (const invalid of ['', 'nope', '#12345', '#1234567', '#gggggg', 'rgb(0,0,0)']) {
      expect(getContrastTextColor(invalid)).toBe(WHITE)
    }
  })
})
