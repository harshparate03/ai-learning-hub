# PDF Download Quick Reference

## 🚀 Quick Start (2 Minutes)

### 1. Add to Component
```typescript
import { PdfDownloadButtonComponent } from './shared/pdf-download-button/pdf-download-button.component';

@Component({
  imports: [PdfDownloadButtonComponent],
})
```

### 2. Add to Template
```html
<app-pdf-download-button
  mainTitle="My Topic"
  sectionTitle="Summary"
  [content]="summaryContent"
></app-pdf-download-button>
```

### 3. Prepare Content
```typescript
summaryContent: PdfLine[] = [
  { type: 'heading', text: 'Summary' },
  { type: 'bullet', text: 'Point 1' },
  { type: 'bullet', text: 'Point 2' }
];
```

Done! ✅

---

## 📋 Common Use Cases

### Use Case 1: Download Visible Section
```typescript
<app-pdf-download-button
  [mainTitle]="'Learning Hub'"
  [sectionTitle]="'Summary'"
  [content]="currentSectionContent"
></app-pdf-download-button>
```

### Use Case 2: Download Section or All
```typescript
<app-pdf-download-button
  [mainTitle]="'Learning Hub'"
  [sectionTitle]="'Key Points'"
  [content]="keyPointsContent"
  [showDownloadAll]="true"
  [allSections]="allSections"
></app-pdf-download-button>
```

### Use Case 3: Minimal Button
```typescript
<app-pdf-download-simple
  mainTitle="Learning Hub"
  sectionTitle="Quiz"
  [content]="quizContent"
></app-pdf-download-simple>
```

### Use Case 4: Custom Implementation
```typescript
constructor(private pdfService: PdfDownloadService) {}

downloadSummary() {
  this.pdfService.downloadSummarySection(
    'Angular Summary',
    ['Components', 'Services', 'Pipes'],
    'Learning Hub',
    { bulletStyle: 'emoji' }
  );
}
```

---

## 🎯 Bullet Styles

| Style | Preview | Best For |
|-------|---------|----------|
| `unicode` | • · ∙ ◦ ◼ ▪ ☑ ✔ ➔ | Professional, Print |
| `emoji` | 🔹 🟠 ⭕ 🔲 ⬜ ✅ 👉 | Modern, Web, Engaging |
| `mixed` | • · ◦ ☐ ☑ ✔ ⭐ ➔ 🚨 | Balanced, Varied |

### Change Style in UI
```typescript
// User can select via button
<app-pdf-download-button
  [showStyleSelector]="true"
  [bulletStyle]="'unicode'"
></app-pdf-download-button>
```

### Change Style Programmatically
```typescript
pdfService.downloadSection(title, content, main, {
  bulletStyle: 'emoji'  // or 'unicode' or 'mixed'
});
```

---

## 📑 PdfLine Types

```typescript
type: 'heading'      // Large title
type: 'subheading'   // Medium subtitle
type: 'para'         // Regular paragraph
type: 'bullet'       // Bullet point
type: 'definition'   // Term + definition box
type: 'code'         // Code block
type: 'table'        // Table data
type: 'divider'      // Horizontal line
type: 'step'         // Numbered step
type: 'kp'           // Key point
type: 'qa-q'         // Q&A question
type: 'qa-a'         // Q&A answer
type: 'chat-user'    // Chat message (user)
type: 'chat-ai'      // Chat message (AI)
```

---

## 🎨 All Available Bullet Symbols

### Unicode (50+ symbols)
```
Dots:        •  ·  ∙  ◦  ●
Squares:     ◼  ▪  ☐  ☑  ☒  □  ▢
Diamonds:    ◆  ◇
Stars:       ★  ☆
Arrows:      ➔  ⇢  ➙  ➜  ›  »
Checks:      ✔  ✘  ✅
Triangles:   ▶  ◀  ▲  ▼
Special:     —  –  ❖  ◊  §  ¶  †  ‡
```

### Emoji (50+ symbols)
```
Dots:        🔹  🟠  🟡  🟢  🔵  🟣  🔴
Squares:     🔲  🟫  ⬜  ⬛  🟪
Checks:      ✅  ❌  👍
Arrows:      ➡️  ⤳  👉  🔜
Stars:       ⭐  ✨
Special:     ⚠️  🚨  📌  💎
```

---

## 💡 Advanced Examples

### Example 1: Multiple Sections
```typescript
const sections = [
  { title: 'Summary', content: summaryLines, type: 'summary' },
  { title: 'Key Points', content: keyLines, type: 'keypoints' },
  { title: 'Quiz', content: quizLines, type: 'quiz' }
];

pdfService.downloadComplete('Main Title', 'Subtitle', sections);
```

### Example 2: Summary Format
```typescript
pdfService.downloadSummarySection(
  'Angular Best Practices',
  [
    'Use OnPush change detection',
    'Implement lazy loading',
    'Optimize bundle size',
    'Use trackBy in *ngFor'
  ],
  'Learning Hub',
  { bulletStyle: 'mixed' }
);
```

### Example 3: Formatted Content
```typescript
pdfService.downloadFormatted(
  'Angular Guide',
  'Complete reference',
  [
    {
      heading: 'Basics',
      items: ['Components', 'Directives', 'Pipes']
    },
    {
      heading: 'Advanced',
      items: ['RxJS', 'Performance', 'Testing']
    }
  ],
  { bulletStyle: 'emoji' }
);
```

### Example 4: Quiz Format
```typescript
pdfService.downloadQuiz(
  'Angular Quiz',
  [
    { q: 'What is a component?', a: 'A building block...' },
    { q: 'What is a service?', a: 'A class that...' }
  ],
  'Learning Hub'
);
```

---

## 🔧 Component Props

### PdfDownloadButtonComponent
```typescript
@Input() mainTitle = 'AI Learning Hub'           // Document title
@Input() sectionTitle = 'Section'                // Section name
@Input() content: PdfLine[] = []                 // Section content
@Input() showDownloadAll = false                 // Show "Download All"
@Input() showStyleSelector = true                // Show style picker
@Input() bulletStyle = 'unicode'                 // Current style
@Input() allSections?: Section[]                 // For "Download All"
@Input() options: PdfDownloadOptions = {}        // Advanced options
```

### PdfDownloadSimpleComponent
```typescript
@Input() mainTitle = 'AI Learning Hub'
@Input() sectionTitle = 'Section'
@Input() content: PdfLine[] = []
@Input() bulletStyle = 'unicode'
```

### PdfContextMenuComponent
```typescript
@Input() mainTitle = 'AI Learning Hub'
@Input() sectionTitle = 'Section'
@Input() content: PdfLine[] = []
@Input() allContent?: PdfLine[]
@Input() bulletStyle = 'unicode'
@Input() showAll = false
```

---

## ⚡ Performance Tips

| Tip | Impact | Example |
|-----|--------|---------|
| Limit to 50 lines per section | Fast | Split large content |
| Use unicode bullets | Faster | Default style |
| Compress large PDFs | -30% size | Add `compress: true` |
| Lazy load sections | ↑ Perceived speed | Load on demand |
| Batch downloads | Memory efficient | Limit to 5 PDFs/min |

---

## 🐛 Common Issues & Fixes

### Issue: PDF not downloading
**Fix**: Check if pop-ups are blocked
```typescript
// Allow pop-ups for your domain in browser settings
```

### Issue: Wrong bullet symbols
**Fix**: Verify bulletStyle prop
```typescript
// ❌ Wrong
<app-pdf-download-button bulletStyle="icons"></app-pdf-download-button>

// ✅ Correct
<app-pdf-download-button bulletStyle="emoji"></app-pdf-download-button>
```

### Issue: Mobile button too small
**Fix**: Component is responsive by default
```typescript
// Component auto-adjusts for mobile
// Just ensure parent has proper width
```

### Issue: Emoji not rendering in PDF
**Fix**: Ensure fonts support emoji
```typescript
// Use 'unicode' or 'mixed' style instead
// Most PDFs support unicode better than emoji
```

---

## 📊 Integration Checklist

- [ ] Import PdfDownloadService
- [ ] Import PdfDownloadButtonComponent
- [ ] Add component to imports array
- [ ] Add to template
- [ ] Create PdfLine[] array
- [ ] Test on desktop
- [ ] Test on mobile
- [ ] Verify PDF downloads
- [ ] Check bullet symbols display

---

## 🎓 Learning Path

1. **Beginner**: Use simple download button
2. **Intermediate**: Add multiple sections
3. **Advanced**: Custom bullet styles and formatting
4. **Expert**: Direct PdfDownloadService usage

---

## 📚 Resources

- Full Guide: `PDF_DOWNLOAD_INTEGRATION_GUIDE.md`
- Service: `src/app/core/services/pdf-download.service.ts`
- Component: `src/app/shared/pdf-download-button/pdf-download-button.component.ts`
- Utils: `src/app/core/utils/pdf-bullet-symbols.util.ts`

---

## ❓ FAQ

**Q: Can I customize the PDF filename?**
A: Yes, the service generates filenames automatically. You can access them via the download event.

**Q: Can I add images to the PDF?**
A: Yes, through PdfLine definition type. Add them in the existing pdf.service.

**Q: Can I password protect the PDF?**
A: Not currently, but can be added via jsPDF plugins.

**Q: Do bullet styles affect file size?**
A: Minimal impact. Unicode bullets are slightly smaller than emoji.

**Q: Can I change colors in the PDF?**
A: Yes, modify the color constants in pdf.service.

**Q: Is there a file size limit?**
A: No hard limit, but very large PDFs (>200 pages) may take time.

---

## 🎉 You're Ready!

Now you can:
- ✅ Download any section as PDF
- ✅ Download complete content
- ✅ Customize bullet symbols
- ✅ Provide professional output
- ✅ Support multiple formats

**Next Steps:**
1. Add to your component
2. Test with sample content
3. Deploy to production
4. Gather user feedback

Happy downloading! 📥
