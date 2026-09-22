import type { ReactNode } from 'react';

const URL_RE_SPLIT = /(https?:\/\/[^\s]+)/g;
const URL_RE_TEST = /^https?:\/\/[^\s]+$/;

/** Renders text with URLs turned into safe links, without dangerouslySetInnerHTML. */
export function linkify(text: string): ReactNode[] {
  const parts = text.split(URL_RE_SPLIT);
  return parts.map((part, i) =>
    URL_RE_TEST.test(part) ? (
      // eslint-disable-next-line react/jsx-key
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
