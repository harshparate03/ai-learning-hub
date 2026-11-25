import { readStoredArray } from './stored-array.util';
describe('readStoredArray', () => {
  afterEach(() => localStorage.removeItem('test-history'));
  it('recovers from invalid JSON and incompatible saved data', () => {
    for (const raw of ['{broken', 'null', '{}', '123']) {
      localStorage.setItem('test-history', raw);
      expect(readStoredArray('test-history')).toEqual([]);
    }
  });
  it('preserves valid saved records and ignores invalid entries', () => {
    localStorage.setItem('test-history', '[null,2,{"title":"Saved Notes"}]');
    expect(readStoredArray('test-history')).toEqual([{ title: 'Saved Notes' }]);
  });
});
