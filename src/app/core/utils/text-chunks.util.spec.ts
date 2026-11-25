import { splitTextIntoChunks } from './text-chunks.util';

describe('splitTextIntoChunks', () => {
  it('bounds a long paragraph without losing words', () => {
    const text = Array(3000).fill('learning').join(' ');
    const chunks = splitTextIntoChunks(text, 7000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(chunk => chunk.length <= 7000)).toBeTrue();
    expect(chunks.join(' ')).toBe(text);
  });
  it('splits text without whitespace', () => {
    const text = 'x'.repeat(15001);
    expect(splitTextIntoChunks(text, 7000).join('')).toBe(text);
    expect(splitTextIntoChunks(text, 7000).map(c => c.length)).toEqual([7000, 7000, 1001]);
  });
  it('handles empty input and rejects invalid limits', () => {
    expect(splitTextIntoChunks('  ', 20)).toEqual([]);
    expect(() => splitTextIntoChunks('abc', 0)).toThrow();
  });
});
