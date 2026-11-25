/** Split every input, including a single long paragraph, without dropping content. */
export function splitTextIntoChunks(text: string, size: number): string[] {
  if (!Number.isInteger(size) || size < 1) throw new Error('Chunk size must be a positive integer.');
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > size) {
    let end = rest.lastIndexOf('\n', size);
    if (end < size / 2) end = rest.lastIndexOf(' ', size);
    if (end < size / 2) end = size;
    chunks.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
