import { jsPDF } from 'jspdf';

export type WhiteboardExportFormat = 'txt' | 'md' | 'doc' | 'pdf';

const sanitizeFileName = (input: string) =>
  input
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'whiteboard';

const createFileName = (title: string, extension: string) =>
  `${sanitizeFileName(title)}-whiteboard.${extension}`;

const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const normalizeWhiteboardHtml = (html: string) => {
  const trimmed = html.trim();
  return trimmed.length > 0 ? trimmed : '<p></p>';
};

const extractPlainText = (html: string) => {
  const normalizedHtml = normalizeWhiteboardHtml(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '$&\n');
  const container = document.createElement('div');
  container.innerHTML = normalizedHtml;
  return (container.textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const escapeMarkdownText = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/([`*_#[\]])/g, '\\$1');

const renderMarkdownInline = (node: ChildNode): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdownText(node.textContent?.replace(/\u00a0/g, ' ') ?? '');
  }

  if (!(node instanceof HTMLElement)) {
    return '';
  }

  const tagName = node.tagName.toLowerCase();
  if (tagName === 'br') {
    return '\n';
  }

  const children = Array.from(node.childNodes).map(renderMarkdownInline).join('');
  if (!children.trim()) {
    return children;
  }

  if (tagName === 'strong' || tagName === 'b') {
    return `**${children}**`;
  }

  if (tagName === 'em' || tagName === 'i') {
    return `*${children}*`;
  }

  if (tagName === 'code') {
    return `\`${children}\``;
  }

  if (tagName === 'a') {
    const href = node.getAttribute('href');
    return href ? `[${children}](${href})` : children;
  }

  return children;
};

const hasBlockChildren = (element: HTMLElement) =>
  Array.from(element.children).some((child) =>
    ['div', 'p', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(
      child.tagName.toLowerCase(),
    ),
  );

const renderMarkdownBlock = (node: ChildNode, depth = 0): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim() ?? '';
    return text ? `${escapeMarkdownText(text)}\n\n` : '';
  }

  if (!(node instanceof HTMLElement)) {
    return '';
  }

  const tagName = node.tagName.toLowerCase();

  if (tagName === 'ul' || tagName === 'ol') {
    const items = Array.from(node.children)
      .filter((child) => child.tagName.toLowerCase() === 'li')
      .map((child, index) => {
        const marker = tagName === 'ol' ? `${index + 1}.` : '-';
        const content = renderMarkdownInline(child).trim();
        return `${'  '.repeat(depth)}${marker} ${content}`;
      })
      .join('\n');
    return items ? `${items}\n\n` : '';
  }

  if (tagName === 'blockquote') {
    const content = Array.from(node.childNodes)
      .map((child) => renderMarkdownBlock(child, depth))
      .join('')
      .trim();
    if (!content) {
      return '';
    }
    return `${content
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')}\n\n`;
  }

  if (/^h[1-6]$/.test(tagName)) {
    const level = Number.parseInt(tagName.slice(1), 10);
    const content = renderMarkdownInline(node).trim();
    return content ? `${'#'.repeat(level)} ${content}\n\n` : '';
  }

  if (tagName === 'div' || tagName === 'p') {
    if (hasBlockChildren(node)) {
      return Array.from(node.childNodes)
        .map((child) => renderMarkdownBlock(child, depth))
        .join('');
    }
    const content = renderMarkdownInline(node).trim();
    return content ? `${content}\n\n` : '';
  }

  if (tagName === 'br') {
    return '\n';
  }

  const content = renderMarkdownInline(node).trim();
  return content ? `${content}\n\n` : '';
};

const convertHtmlToMarkdown = (html: string) => {
  const container = document.createElement('div');
  container.innerHTML = normalizeWhiteboardHtml(html);
  return Array.from(container.childNodes)
    .map((node) => renderMarkdownBlock(node))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const createWordDocument = (title: string, html: string) => {
  const documentHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body {
        font-family: Arial, "Microsoft YaHei", sans-serif;
        line-height: 1.7;
        color: #0f172a;
        padding: 32px;
      }
      h1, h2, h3, h4, h5, h6 {
        margin-top: 1.2em;
      }
      p, div, li {
        margin: 0 0 0.75em;
      }
    </style>
  </head>
  <body>
    ${normalizeWhiteboardHtml(html)}
  </body>
</html>`;
  return new Blob(['\ufeff', documentHtml], {
    type: 'application/msword;charset=utf-8',
  });
};

const exportAsPdf = async (title: string, html: string) => {
  const container = document.createElement('div');
  container.innerHTML = normalizeWhiteboardHtml(html);
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = '760px';
  container.style.padding = '32px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = 'Arial, "Microsoft YaHei", sans-serif';
  container.style.lineHeight = '1.7';
  container.style.boxSizing = 'border-box';
  document.body.appendChild(container);

  try {
    const pdf = new jsPDF({
      unit: 'pt',
      format: 'a4',
      compress: true,
    });

    await new Promise<void>((resolve, reject) => {
      void pdf.html(container, {
        margin: [36, 36, 36, 36],
        autoPaging: 'text',
        width: 523,
        windowWidth: 760,
        html2canvas: {
          scale: 0.72,
          backgroundColor: '#ffffff',
        },
        callback: (doc) => {
          try {
            doc.save(createFileName(title, 'pdf'));
            resolve();
          } catch (error) {
            reject(error);
          }
        },
      });
    });
  } finally {
    document.body.removeChild(container);
  }
};

export const exportWhiteboardContent = async (
  title: string,
  html: string,
  format: WhiteboardExportFormat,
) => {
  if (format === 'txt') {
    downloadBlob(
      new Blob([extractPlainText(html)], { type: 'text/plain;charset=utf-8' }),
      createFileName(title, 'txt'),
    );
    return;
  }

  if (format === 'md') {
    downloadBlob(
      new Blob([convertHtmlToMarkdown(html)], { type: 'text/markdown;charset=utf-8' }),
      createFileName(title, 'md'),
    );
    return;
  }

  if (format === 'doc') {
    downloadBlob(createWordDocument(title, html), createFileName(title, 'doc'));
    return;
  }

  await exportAsPdf(title, html);
};
