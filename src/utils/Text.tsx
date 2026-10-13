import { Fragment, type ReactNode } from "react";

// *bold* and _underline_
function parseInline(text: string): ReactNode[] {
  const re = /\*([^*]+)\*|_([^_]+)_/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(
      match[1] !== undefined
        ? <strong key={key++}>{parseInline(match[1])}</strong>
        : <u key={key++}>{parseInline(match[2])}</u>
    );
    last = re.lastIndex;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function formatText(text: string): ReactNode {
  return text.split(/\n|\\n/).map((line, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {parseInline(line)}
    </Fragment>
  ));
}
