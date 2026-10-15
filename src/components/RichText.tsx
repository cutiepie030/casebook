import { createElement, type ReactNode } from 'react';
// Render only basic formatting; imported HTML never becomes executable markup.
const allowed = new Set([
  'p',
  'strong',
  'b',
  'em',
  'i',
  'ul',
  'ol',
  'li',
  'br',
  'blockquote',
  'h2',
  'h3',
  'hr',
  's',
]);
export function RichText({ value }: { value: string }) {
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  function render(node: Node, key: number): ReactNode {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (!(node instanceof Element)) return null;
    const tag = node.tagName.toLowerCase();
    if (['script', 'style', 'iframe', 'object', 'img'].includes(tag)) return null;
    const children = Array.from(node.childNodes).map((n, i) => render(n, i));
    return allowed.has(tag)
      ? createElement(tag, { key }, tag === 'br' || tag === 'hr' ? undefined : children)
      : children;
  }
  return (
    <div className="rich-reading">
      {Array.from(parsed.body.childNodes).map((node, i) => render(node, i))}
    </div>
  );
}
