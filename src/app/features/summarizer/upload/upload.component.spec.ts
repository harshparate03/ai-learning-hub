import { UploadComponent } from './upload.component';
import { AiService } from '../../../core/services/ai.service';
import { PdfService } from '../../../core/services/pdf.service';
import { jsPDF } from 'jspdf';
describe('UploadComponent', () => {
  let component: UploadComponent;
  beforeEach(() => { component = new UploadComponent({} as AiService, {} as PdfService); });
  it('rejects unsupported binary PPT with an actionable message', async () => {
    await component.onFileSelected({ target: { files: [new File(['binary'], 'old.ppt')] } });
    expect(component.errorMsg).toContain('Unsupported file type');
    expect(component.canGenerate).toBeFalse();
  });
  it('does not generate while a file is being read', () => {
    component.inputText = 'Text'; component.readingFile = true;
    expect(component.canGenerate).toBeFalse();
  });
  it('bounds a single long paragraph', () => {
    expect(component.chunkText('x'.repeat(15000), 7000).map(c => c.length)).toEqual([7000, 7000, 1000]);
  });
  it('keeps PDF data usable for text and subsequent image extraction', async () => {
    const pdf = new jsPDF();
    pdf.text('Learning Hub document', 10, 10);
    const canvas = document.createElement('canvas');
    canvas.width = 10; canvas.height = 10;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#336699'; context.fillRect(0, 0, 10, 10);
    pdf.addImage(canvas, 'JPEG', 10, 30, 10, 10);
    component.mode = 'file';
    await component.onFileSelected({ target: { files: [new File([pdf.output('arraybuffer')], 'study.pdf')] } });
    expect(component.fileContent).toContain('Learning Hub document');
    expect(component.pdfArrayBuffer!.byteLength).toBeGreaterThan(0);
    await component.extractPdfImages();
    expect(component.errorMsg).toBe('');
    expect(component.pdfImages.length).toBe(1);
  }, 15000);
});
