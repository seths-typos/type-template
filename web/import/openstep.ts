/**
 * The old-style (OpenStep) property list Glyphs saves in: `{ key = value; }`
 * dictionaries, `( a, b )` arrays, quoted or bare strings, and `<hex>` data.
 * Bare strings that read as numbers come back as numbers.
 */
export type PlistValue = string | number | PlistValue[] | { [key: string]: PlistValue };

/** A bare string runs until whitespace or punctuation. */
const BARE = /[^\s{}()<>"=;,]+/y;

export function parseOpenStep(text: string): PlistValue {
  let i = 0;

  const fail = (what: string): never => {
    throw new SyntaxError(`${what} at character ${i}.`);
  };

  function skip(): void {
    for (;;) {
      const c = text[i];
      if (c === ' ' || c === '\n' || c === '\r' || c === '\t') i++;
      else if (c === '/' && text[i + 1] === '/') {
        while (i < text.length && text[i] !== '\n') i++;
      } else if (c === '/' && text[i + 1] === '*') {
        const end = text.indexOf('*/', i + 2);
        if (end < 0) fail('Unclosed comment');
        i = end + 2;
      } else return;
    }
  }

  function value(): PlistValue {
    skip();
    const c = text[i];
    if (c === '{') return dict();
    if (c === '(') return array();
    if (c === '"') return quoted();
    if (c === '<') return data();
    return bare();
  }

  function dict(): { [key: string]: PlistValue } {
    i++;
    const out: { [key: string]: PlistValue } = {};
    for (;;) {
      skip();
      if (text[i] === '}') {
        i++;
        return out;
      }
      const key = value();
      if (typeof key === 'object') fail('Expected a key');
      skip();
      if (text[i] !== '=') fail('Expected "="');
      i++;
      out[String(key)] = value();
      skip();
      if (text[i] === ';') i++;
      else if (text[i] !== '}') fail('Expected ";"');
    }
  }

  function array(): PlistValue[] {
    i++;
    const out: PlistValue[] = [];
    for (;;) {
      skip();
      if (text[i] === ')') {
        i++;
        return out;
      }
      out.push(value());
      skip();
      if (text[i] === ',') i++;
      else if (text[i] !== ')') fail('Expected "," or ")"');
    }
  }

  function quoted(): string {
    i++;
    let out = '';
    for (;;) {
      if (i >= text.length) fail('Unclosed string');
      const c = text[i++]!;
      if (c === '"') return out;
      if (c !== '\\') {
        out += c;
        continue;
      }
      const e = text[i++]!;
      if (e === 'n') out += '\n';
      else if (e === 't') out += '\t';
      else if (e === 'r') out += '\r';
      else if (e === 'U' || e === 'u') {
        const hex = /^[0-9a-fA-F]{1,4}/.exec(text.slice(i, i + 4))![0];
        out += String.fromCharCode(parseInt(hex, 16));
        i += hex.length;
      } else if (/[0-7]/.test(e)) {
        const oct = /^[0-7]{1,3}/.exec(text.slice(i - 1, i + 2))![0];
        out += String.fromCharCode(parseInt(oct, 8));
        i += oct.length - 1;
      } else out += e;
    }
  }

  function data(): string {
    const end = text.indexOf('>', i);
    if (end < 0) fail('Unclosed data');
    const out = text.slice(i + 1, end);
    i = end + 1;
    return out;
  }

  function bare(): string | number {
    BARE.lastIndex = i;
    const match = BARE.exec(text);
    if (!match) fail('Unexpected character');
    const word = match![0];
    i += word.length;
    return /^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(word) ? Number(word) : word;
  }

  const root = value();
  skip();
  if (i < text.length) fail('Unexpected text after the end');
  return root;
}
