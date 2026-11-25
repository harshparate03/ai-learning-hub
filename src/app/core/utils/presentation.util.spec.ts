import { createPresentation } from './presentation.util';

describe('browser presentation exporter', () => {
  it('loads the browser library and produces a real presentation', async () => {
    const presentation = await createPresentation();
    presentation.addSlide().addText('AI Learning Hub', { x: 1, y: 1, w: 5, h: 1 });
    const result = await presentation.write({ outputType: 'blob' });
    expect(result instanceof Blob).toBeTrue();
    expect((result as Blob).size).toBeGreaterThan(1000);
  });
});
