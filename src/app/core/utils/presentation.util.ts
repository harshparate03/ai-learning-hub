import type PptxGenJS from 'pptxgenjs';

let loader: Promise<typeof PptxGenJS> | undefined;
/** Use the library's browser build; its Node entry imports fs/https in Karma. */
export async function createPresentation(): Promise<PptxGenJS> {
  if (!loader) {
    loader = new Promise<typeof PptxGenJS>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/pptxgen.bundle.js';
      script.onload = () => {
        const Constructor = (globalThis as typeof globalThis & { PptxGenJS?: typeof PptxGenJS }).PptxGenJS;
        if (Constructor) resolve(Constructor);
        else { loader = undefined; reject(new Error('Presentation exporter could not load.')); }
      };
      script.onerror = () => { script.remove(); loader = undefined; reject(new Error('Presentation exporter could not load. Please try again.')); };
      document.head.appendChild(script);
    });
  }
  const Constructor = await loader;
  return new Constructor();
}
