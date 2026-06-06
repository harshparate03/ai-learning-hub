export interface ChatBlock {
  type: 'heading' | 'subheading' | 'para' | 'list' | 'table' | 'code' | 'diagram' | 'divider';
  content: string;
  items?: string[];
  rows?: string[][];
}

/** Parse AI chat markdown-like text into renderable blocks. */
export function parseChatContent(text: string): ChatBlock[] {
  if (!text?.trim()) return [];

  const blocks: ChatBlock[] = [];
  const lines = text.split('\n');
  let listItems: string[] = [];
  let tableLines: string[] = [];
  let codeLines: string[] = [];
  let paraLines: string[] = [];
  let inCode = false;

  const flushPara = () => {
    const t = paraLines.join('\n').trim();
    if (t) blocks.push({ type: 'para', content: t });
    paraLines = [];
  };

  const flushList = () => {
    if (listItems.length) {
      flushPara();
      blocks.push({ type: 'list', content: '', items: [...listItems] });
      listItems = [];
    }
  };

  const flushTable = () => {
    if (tableLines.length >= 2) {
      const rows = tableLines
        .map(l => l.split('|').map(c => c.trim()).filter((c, i, a) => !(i === 0 && c === '') && !(i === a.length - 1 && c === '')))
        .filter(r => r.length && !r.every(c => /^[-:]+$/.test(c)));
      if (rows.length >= 2) {
        flushPara(); flushList();
        blocks.push({ type: 'table', content: '', rows });
      } else {
        paraLines.push(...tableLines);
      }
    } else {
      paraLines.push(...tableLines);
    }
    tableLines = [];
  };

  const flushCode = (asDiagram = false) => {
    const code = codeLines.join('\n').trim();
    if (code) {
      flushPara(); flushList(); flushTable();
      const isDiagram = asDiagram || /^[\s│┌┐└┘├┤┬┴┼─═║╔╗╚╝╠╣╦╩╬+\-|/*\\>]+$/.test(code.replace(/\n/g, ''));
      blocks.push({ type: isDiagram ? 'diagram' : 'code', content: code });
    }
    codeLines = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        inCode = false;
        flushCode();
      } else {
        inCode = true;
        flushPara(); flushList(); flushTable();
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (/^#{1,2}\s+/.test(line)) {
      flushList(); flushTable(); flushPara();
      blocks.push({ type: 'heading', content: line.replace(/^#{1,2}\s+/, '').trim() });
      continue;
    }

    if (/^#{3,6}\s+/.test(line)) {
      flushList(); flushTable(); flushPara();
      blocks.push({ type: 'subheading', content: line.replace(/^#{3,6}\s+/, '').trim() });
      continue;
    }

    if (/^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      if (tableLines.length) flushTable();
      if (paraLines.length) flushPara();
      listItems.push(line.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '').trim());
      continue;
    }

    const isTableRow = line.includes('|') && line.trim().startsWith('|');
    if (isTableRow) {
      if (listItems.length) flushList();
      if (paraLines.length) flushPara();
      tableLines.push(line);
      continue;
    }

    if (/^[-*_]{3,}$/.test(line.trim())) {
      flushList(); flushTable(); flushPara();
      blocks.push({ type: 'divider', content: '' });
      continue;
    }

    if (line.trim() === '') {
      if (tableLines.length) flushTable();
      if (listItems.length) flushList();
      flushPara();
      continue;
    }

    if (tableLines.length) flushTable();
    if (listItems.length) flushList();
    paraLines.push(line);
  }

  if (inCode) flushCode();
  if (tableLines.length) flushTable();
  if (listItems.length) flushList();
  flushPara();

  return blocks.length ? blocks : [{ type: 'para', content: text.trim() }];
}
