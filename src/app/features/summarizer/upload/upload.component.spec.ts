import { UploadComponent } from './upload.component';
import { AiService } from '../../../core/services/ai.service';
import { PdfService } from '../../../core/services/pdf.service';
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
});
