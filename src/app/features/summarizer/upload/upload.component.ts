import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService } from '../../../core/services/ai.service';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import pptxgen from 'pptxgenjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface SubTopic {
  title: string;
  explanation: string;
  bullets: string[];
}

export interface TopicBlock {
  title: string;
  explanation: string;
  subtopics: SubTopic[];
  bullets: string[];
  codes: { lang: string; code: string }[];
  image: string;
}

export interface QABlock {
  q: string;
  a: string;
  steps: string[];
  image: string;
}

import { AiSparkComponent } from '../../../shared/ai-spark/ai-spark.component';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, AiSparkComponent],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.css'
})
export class UploadComponent {

  mode: 'text' | 'file' = 'text';
  inputText: string = '';
  fileContent: string = '';
  fileName: string = '';
  pdfImages: { pageNum: number; dataUrl: string }[] = [];
  pdfArrayBuffer: ArrayBuffer | null = null;

  topics: TopicBlock[] = [];
  questions: QABlock[] = [];
  loading: boolean = false;
  errorMsg: string = '';
  progress: string = '';
  chunkResults: string[] = [];
  downloadFormat: string = 'pdf';
  copiedIndex: number = -1;
  detectedSubject: string = '';

  constructor(private ai: AiService) {}

  switchMode(m: 'text' | 'file') {
    this.mode = m;
    this.reset();
  }

  reset() {
    this.inputText = '';
    this.fileContent = '';
    this.fileName = '';
    this.pdfImages = [];
    this.pdfArrayBuffer = null;
    this.topics = [];
    this.questions = [];
    this.errorMsg = '';
    this.progress = '';
    this.chunkResults = [];
    this.detectedSubject = '';
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.reset();
    this.fileName = file.name;
    this.progress = 'Reading file...';

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'txt') {
      this.fileContent = await file.text();
      this.progress = '';
    }

    if (ext === 'pdf') {
      this.pdfArrayBuffer = await file.arrayBuffer();
      const typedArray = new Uint8Array(this.pdfArrayBuffer as ArrayBuffer);
      const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        this.progress = `Reading page ${i} of ${pdf.numPages}...`;
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += `\n--- Page ${i} ---\n`;
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      this.fileContent = text;
      this.progress = '';
    }

    if (ext === 'docx' || ext === 'pptx' || ext === 'ppt') {
      this.fileContent = `[${file.name}] uploaded.`;
      this.progress = '';
    }
  }

  get canGenerate(): boolean {
    return this.mode === 'text'
      ? this.inputText.trim().length > 0
      : this.fileContent.length > 0;
  }

  chunkText(text: string, size: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.slice(i, i + size));
    }
    return chunks;
  }

  async extractPdfImages() {
    if (!this.pdfArrayBuffer) return;
    try {
      const typedArray = new Uint8Array(this.pdfArrayBuffer as ArrayBuffer);
      const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const ops = await page.getOperatorList();
        const hasImage = ops.fnArray.some((fn: any) =>
          fn === pdfjsLib.OPS.paintImageXObject ||
          fn === pdfjsLib.OPS.paintImageMaskXObject
        );
        if (hasImage) {
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          this.pdfImages.push({ pageNum: i, dataUrl: canvas.toDataURL('image/jpeg', 0.75) });
        }
      }
    } catch {}
  }

  async generateAI() {
    if (!this.canGenerate) return;

    this.loading = true;
    this.errorMsg = '';
    this.topics = [];
    this.questions = [];
    this.pdfImages = [];
    this.chunkResults = [];
    this.detectedSubject = '';

    const content = this.mode === 'text' ? this.inputText : this.fileContent;
    const chunks = this.chunkText(content, 3000);

    this.extractPdfImages();

    try {
      for (let i = 0; i < chunks.length; i++) {
        this.progress = `📄 Processing section ${i + 1} of ${chunks.length}...`;

        const prompt = `You are an expert academic content creator. Extract EVERY topic and subtopic from this section with full detail.

For EACH main topic use this EXACT format:

##TOPIC## **Main Topic Title**
##EXPLANATION## Brief 2-3 sentence overview with **bold** key terms.
##SUBTOPICS##
###SUB### **Subtopic Title**
###SUBEXP### Full detailed explanation with **bold** key terms.
###SUBBULLETS###
- **Term**: detailed explanation
- **Term**: detailed explanation
- **Term**: detailed explanation
###SUBEND###
##ENDSUB##
##BULLETS##
- **Key Term**: explanation
- **Key Term**: explanation
##CODE## language
code here
##ENDCODE##
##IMAGE## If this topic has any diagram, flowchart, figure, table, or visual — describe it in detail. If none, write NONE.
##END##

STRICT Rules:
- Extract ALL topics and ALL subtopics - do NOT skip anything
- ALL topic and subtopic titles MUST be wrapped in **bold**
- Bullets must be **Term**: explanation format
- ONLY add ##CODE## if ACTUAL CODE exists in content
- Be thorough and complete

CONTENT:
${chunks[i]}`;

        const res: any = await this.ai.generateWithGroq(prompt).toPromise();
        const text = res?.choices?.[0]?.message?.content
          || res?.candidates?.[0]?.content?.parts?.[0]?.text
          || res?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('')
          || '';
        this.chunkResults.push(text);

        this.parseTopics(this.chunkResults.join('\n\n'));
        this.progress = `✅ Section ${i + 1} of ${chunks.length} done — ${this.topics.length} topics found...`;

        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      this.detectedSubject = this.topics.slice(0, 3).map(t => t.title.replace(/\*\*/g, '')).join(', ');
      this.progress = '🧠 Generating Exam Q&A...';

      const topicList = this.topics.map((t, i) => `${i + 1}. ${t.title.replace(/\*\*/g, '')}`).join('\n');

      const qaPrompt = `You are an expert exam preparation specialist.

Document is about: ${this.detectedSubject}

Topics:
${topicList}

Generate 10 exam questions based on these topics. Start DIRECTLY with ##Q##. No intro text.

EXACT FORMAT:

##Q## **Question title here?**
##A## Detailed introduction with **bold** key terms. 3-4 sentences minimum.
##STEPS##
- **Point 1 Title**: Full detailed explanation with example
- **Point 2 Title**: Full detailed explanation with example
- **Point 3 Title**: Full detailed explanation with example
- **Point 4 Title**: Full detailed explanation with example
- **Point 5 Title**: Full detailed explanation with example
##QIMAGE## NONE
##QEND##

CONTENT:
${this.chunkResults.join('\n\n').slice(0, 8000)}`;

      const qaRes: any = await this.ai.generateWithGroq(qaPrompt).toPromise();
      const qaText = qaRes?.choices?.[0]?.message?.content
        || qaRes?.candidates?.[0]?.content?.parts?.[0]?.text
        || qaRes?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('')
        || '';
      this.parseQuestions(qaText);

      this.progress = '';
      this.loading = false;

    } catch (err: any) {
      const status = err?.status;
      const msg = err?.error?.error?.message || err?.message || 'AI processing failed.';
      if (status === 401 || status === 403) {
        this.errorMsg = 'API key is not valid. Please check the API key configuration.';
      } else if (status === 429) {
        this.errorMsg = 'Rate limit reached. Please wait a moment and try again.';
      } else if (status === 0 || !status) {
        this.errorMsg = 'Network error — check your internet connection and try again.';
      } else {
        this.errorMsg = msg;
      }
      this.progress = '';
      this.loading = false;
    }
  }

  parseTopics(text: string) {
    this.topics = [];
    const blocks = text.split('##TOPIC##').filter(b => b.trim());

    for (const block of blocks) {
      const titleMatch = block.match(/^([\s\S]*?)##EXPLANATION##/);
      const explanationMatch = block.match(/##EXPLANATION##([\s\S]*?)(?:##SUBTOPICS##|##BULLETS##|##END##)/);
      const bulletsMatch = block.match(/##BULLETS##([\s\S]*?)(?:##CODE##|##IMAGE##|##END##)/);
      const imageMatch = block.match(/##IMAGE##([\s\S]*?)##END##/);

      const title = titleMatch ? titleMatch[1].trim() : '';
      const explanation = explanationMatch ? explanationMatch[1].trim() : '';
      const bulletsRaw = bulletsMatch ? bulletsMatch[1].trim() : '';
      const image = imageMatch ? imageMatch[1].trim() : '';

      const bullets = bulletsRaw.split('\n')
        .map((l: string) => l.replace(/^[-•*]\s*/, '').trim())
        .filter((l: string) => l.length > 2);

      // parse subtopics
      const subtopics: SubTopic[] = [];
      const subBlocks = block.split('###SUB###').slice(1);
      for (const sb of subBlocks) {
        const subTitleMatch = sb.match(/^([\s\S]*?)###SUBEXP###/);
        const subExpMatch = sb.match(/###SUBEXP###([\s\S]*?)(?:###SUBBULLETS###|###SUBEND###)/);
        const subBulletsMatch = sb.match(/###SUBBULLETS###([\s\S]*?)###SUBEND###/);

        const subTitle = subTitleMatch ? subTitleMatch[1].trim() : '';
        const subExp = subExpMatch ? subExpMatch[1].trim() : '';
        const subBulletsRaw = subBulletsMatch ? subBulletsMatch[1].trim() : '';
        const subBullets = subBulletsRaw.split('\n')
          .map((l: string) => l.replace(/^[-•*]\s*/, '').trim())
          .filter((l: string) => l.length > 2);

        if (subTitle) subtopics.push({ title: subTitle, explanation: subExp, bullets: subBullets });
      }

      const codes: { lang: string; code: string }[] = [];
      const codeRegex = /##CODE##\s*(\w*)\n([\s\S]*?)##ENDCODE##/g;
      let codeMatch;
      while ((codeMatch = codeRegex.exec(block)) !== null) {
        const codeContent = codeMatch[2].trim();
        if (codeContent.length > 5) codes.push({ lang: codeMatch[1] || 'code', code: codeContent });
      }

      if (title) {
        const cleanImage = image.trim();
        this.topics.push({ title, explanation, subtopics, bullets, codes,
          image: (!cleanImage || cleanImage.toUpperCase() === 'NONE' || cleanImage.length < 5) ? '' : cleanImage
        });
      }
    }
  }

  parseQuestions(text: string) {
    this.questions = [];
    const startIdx = text.indexOf('##Q##');
    if (startIdx === -1) return;
    const blocks = text.slice(startIdx).split('##Q##').filter(b => b.trim());

    for (const block of blocks) {
      const qMatch = block.match(/^([\s\S]*?)##A##/);
      const aMatch = block.match(/##A##([\s\S]*?)(?:##STEPS##|##QIMAGE##|##QEND##)/);
      const stepsMatch = block.match(/##STEPS##([\s\S]*?)(?:##QIMAGE##|##QEND##)/);
      const imageMatch = block.match(/##QIMAGE##([\s\S]*?)##QEND##/);

      const q = qMatch ? qMatch[1].trim() : '';
      const a = aMatch ? aMatch[1].trim() : '';
      const stepsRaw = stepsMatch ? stepsMatch[1].trim() : '';
      const image = imageMatch ? imageMatch[1].trim() : '';

      const steps = stepsRaw.split('\n')
        .map((l: string) => l.replace(/^[-•*]\s*/, '').trim())
        .filter((l: string) => l.length > 5);

      if (q) this.questions.push({ q, a, steps, image: image === 'NONE' || !image ? '' : image });
    }
  }

  renderBold(text: string): string {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  copyCode(code: string, index: number) {
    navigator.clipboard.writeText(code);
    this.copiedIndex = index;
    setTimeout(() => this.copiedIndex = -1, 2000);
  }

  download() {
    switch (this.downloadFormat) {
      case 'pdf': this.downloadPDF(); break;
      case 'docx': this.downloadDOCX(); break;
      case 'ppt': this.downloadPPT(); break;
      case 'txt': this.downloadTXT(); break;
    }
  }

  downloadTXT() {
    let content = `STUDY NOTES - ${this.fileName}\n${'='.repeat(50)}\n\n`;
    this.topics.forEach((t, i) => {
      content += `${i + 1}. ${t.title.replace(/\*\*/g, '')}\n${'-'.repeat(40)}\n`;
      content += `${t.explanation.replace(/\*\*(.*?)\*\*/g, '$1')}\n\n`;
      t.subtopics.forEach(s => {
        content += `  >> ${s.title.replace(/\*\*/g, '')}\n`;
        content += `  ${s.explanation.replace(/\*\*(.*?)\*\*/g, '$1')}\n`;
        s.bullets.forEach(b => content += `    • ${b}\n`);
        content += '\n';
      });
      t.bullets.forEach(b => content += `  • ${b}\n`);
      t.codes.forEach(c => content += `\n[${c.lang}]\n${c.code}\n`);
      if (t.image) content += `\n[Diagram]: ${t.image}\n`;
      content += '\n';
    });
    content += '\nEXAM Q&A\n' + '='.repeat(50) + '\n\n';
    this.questions.forEach((q, i) => {
      content += `Q${i + 1}. ${q.q.replace(/\*\*/g, '')}\nAnswer: ${q.a.replace(/\*\*(.*?)\*\*/g, '$1')}\n`;
      q.steps.forEach((s, si) => content += `  ${si + 1}. ${s}\n`);
      content += '\n';
    });
    this.triggerDownload(new Blob([content], { type: 'text/plain' }), 'study-notes.txt');
  }

  downloadPDF() {
    const doc = new jsPDF();
    let y = 20;
    const pageH = doc.internal.pageSize.height;
    const addText = (text: string, size: number, bold: boolean, color: number[]) => {
      doc.setFontSize(size);
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(color[0], color[1], color[2]);
      doc.splitTextToSize(text.replace(/\*\*(.*?)\*\*/g, '$1'), 180).forEach((line: string) => {
        if (y > pageH - 20) { doc.addPage(); y = 20; }
        doc.text(line, 15, y); y += 7;
      });
      y += 3;
    };
    addText(`Study Notes - ${this.fileName}`, 18, true, [0, 150, 200]);
    this.topics.forEach((t, i) => {
      addText(`${i + 1}. ${t.title}`, 14, true, [0, 100, 180]);
      addText(t.explanation, 10, false, [50, 50, 50]);
      t.subtopics.forEach(s => {
        addText(`  >> ${s.title}`, 11, true, [0, 120, 160]);
        addText(s.explanation, 10, false, [60, 60, 60]);
        s.bullets.forEach(b => addText(`    • ${b}`, 9, false, [40, 40, 40]));
      });
      t.bullets.forEach(b => addText(`• ${b}`, 10, false, [30, 30, 30]));
      t.codes.forEach(c => addText(`[${c.lang}] ${c.code}`, 9, false, [80, 80, 80]));
      if (t.image) addText(`Diagram: ${t.image}`, 9, false, [100, 100, 100]);
    });
    addText('EXAM Q&A', 16, true, [0, 150, 200]);
    this.questions.forEach((q, i) => {
      addText(`Q${i + 1}. ${q.q}`, 12, true, [0, 80, 160]);
      addText(`Answer: ${q.a}`, 10, false, [40, 40, 40]);
      q.steps.forEach((s, si) => addText(`  ${si + 1}. ${s}`, 10, false, [40, 40, 40]));
    });
    doc.save('study-notes.pdf');
  }

  async downloadDOCX() {
    const children: any[] = [new Paragraph({ text: `Study Notes - ${this.fileName}`, heading: HeadingLevel.TITLE })];
    this.topics.forEach((t, i) => {
      children.push(new Paragraph({ text: `${i + 1}. ${t.title.replace(/\*\*/g, '')}`, heading: HeadingLevel.HEADING_1 }));
      children.push(new Paragraph({ children: [new TextRun(t.explanation.replace(/\*\*(.*?)\*\*/g, '$1'))] }));
      t.subtopics.forEach(s => {
        children.push(new Paragraph({ text: s.title.replace(/\*\*/g, ''), heading: HeadingLevel.HEADING_2 }));
        children.push(new Paragraph({ children: [new TextRun(s.explanation.replace(/\*\*(.*?)\*\*/g, '$1'))] }));
        s.bullets.forEach(b => children.push(new Paragraph({ text: `• ${b}` })));
      });
      t.bullets.forEach(b => children.push(new Paragraph({ text: `• ${b}` })));
      t.codes.forEach(c => children.push(new Paragraph({ children: [new TextRun({ text: c.code, font: 'Courier New' })] })));
      if (t.image) children.push(new Paragraph({ text: `Diagram: ${t.image}` }));
    });
    children.push(new Paragraph({ text: 'Exam Q&A', heading: HeadingLevel.HEADING_1 }));
    this.questions.forEach((q, i) => {
      children.push(new Paragraph({ children: [new TextRun({ text: `Q${i + 1}. ${q.q.replace(/\*\*/g, '')}`, bold: true })] }));
      children.push(new Paragraph({ text: `Answer: ${q.a.replace(/\*\*(.*?)\*\*/g, '$1')}` }));
      q.steps.forEach((s, si) => children.push(new Paragraph({ text: `  ${si + 1}. ${s}` })));
    });
    const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
    this.triggerDownload(blob, 'study-notes.docx');
  }

  downloadPPT() {
    const pptx = new pptxgen();
    this.topics.forEach(t => {
      const slide = pptx.addSlide();
      slide.addText(t.title.replace(/\*\*/g, ''), { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 20, bold: true, color: '0096C8' });
      const body = t.subtopics.length > 0
        ? t.subtopics.map(s => `• ${s.title.replace(/\*\*/g, '')}: ${s.explanation.slice(0, 100)}`).join('\n')
        : t.bullets.map(b => `• ${b}`).join('\n') || t.explanation.slice(0, 300);
      slide.addText(body, { x: 0.5, y: 1.2, w: 9, h: 4, fontSize: 11, color: '333333', wrap: true });
    });
    this.questions.forEach((q, i) => {
      const slide = pptx.addSlide();
      slide.addText(`Q${i + 1}. ${q.q.replace(/\*\*/g, '')}`, { x: 0.5, y: 0.3, w: 9, h: 0.8, fontSize: 16, bold: true, color: '0096C8' });
      slide.addText(`${q.a}\n\n${q.steps.map((s, si) => `${si + 1}. ${s}`).join('\n')}`.replace(/\*\*(.*?)\*\*/g, '$1'), { x: 0.5, y: 1.2, w: 9, h: 4.8, fontSize: 11, color: '222222', wrap: true });
    });
    pptx.writeFile({ fileName: 'study-notes.pptx' });
  }

  triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}
