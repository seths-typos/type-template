import { describe, expect, it } from 'vitest';
import { mastersAgree } from '../import/font-source.js';
import { readGlyphs } from '../import/glyphs.js';
import { parseOpenStep } from '../import/openstep.js';
import { applyFontMetrics, readUpload } from '../import/read-upload.js';
import { readUfoFontInfo } from '../import/ufo.js';
import { isZip, readZipEntry } from '../import/zip.js';
import { newRowState } from '../row-input.js';
import { readSheetFile, SheetFileError, writeSheetFile, type SheetState } from '../sheet-file.js';
import { defaultLineStyles } from '../line-styles.js';
import { emptyHeaderText } from '../header-panel.js';
import { defaultPageSetup } from '../sheet-preview.js';

const bytes = (text: string) => new TextEncoder().encode(text).buffer as ArrayBuffer;

// As Glyphs 3 writes it: no indentation, a missing pos meaning 0.
const GLYPHS = `{
.appVersion = "3343";
.formatVersion = 3;
fontMaster = (
{
id = A;
metricValues = (
{
over = 15;
pos = 830;
},
{
over = -15;
},
{
pos = -249;
},
{
pos = 1000;
},
{
pos = 999;
}
);
name = Bold;
},
{
id = B;
metricValues = (
{
pos = 800;
},
{
},
{
pos = -240;
},
{
pos = 980;
},
{
}
);
name = "Light \\"Text\\"";
}
);
metrics = (
{
type = "cap height";
},
{
type = baseline;
},
{
type = descender;
},
{
type = ascender;
},
{
filter = "name == \\"a\\"";
type = "x-height";
}
);
unitsPerEm = 1010;
}`;

describe('parseOpenStep', () => {
  it('reads dictionaries, arrays, quoted and bare strings, numbers and data', () => {
    expect(parseOpenStep('{a = 1; b = (x, "y z", -2.5); c = <0A0B>; d = {};}')).toEqual({
      a: 1,
      b: ['x', 'y z', -2.5],
      c: '0A0B',
      d: {},
    });
  });

  it('reads escapes', () => {
    expect(parseOpenStep('"a\\"b\\\\c\\012\\U2019"')).toBe('a"b\\c\n’');
  });

  it('keeps bare words that only start like numbers as strings', () => {
    expect(parseOpenStep('(1.2.3, 0x10, 12a)')).toEqual(['1.2.3', '0x10', '12a']);
  });

  it('rejects broken input', () => {
    expect(() => parseOpenStep('{a = 1')).toThrow(SyntaxError);
  });
});

describe('readGlyphs', () => {
  it("reads each master's metrics in the order the font lists them", () => {
    const { masters } = readGlyphs(GLYPHS);
    expect(masters).toEqual([
      { name: 'Bold', metrics: { capHeight: 830, descender: -249, ascender: 1000 } },
      { name: 'Light "Text"', metrics: { capHeight: 800, descender: -240, ascender: 980 } },
    ]);
  });

  it('passes over metrics limited by a filter', () => {
    expect(readGlyphs(GLYPHS).masters[0]!.metrics.xHeight).toBeUndefined();
  });

  it('reads the italic angle as is, and a missing pos as 0', () => {
    const text = `{.formatVersion = 3; metrics = ({type = "italic angle";}, {type = "x-height";});
      fontMaster = ({name = It; metricValues = ({pos = 12;}, {});});}`;
    expect(readGlyphs(text).masters[0]!.metrics).toEqual({ italicAngle: 12, xHeight: 0 });
  });

  it('refuses a Glyphs 2 file', () => {
    expect(() => readGlyphs('{fontMaster = ({ascender = 800;});}')).toThrow(/Glyphs 2/);
  });

  it('refuses a file with no masters', () => {
    expect(() => readGlyphs('{.formatVersion = 3;}')).toThrow(/no masters/);
  });
});

describe('readUfoFontInfo', () => {
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>ascender</key>
  <integer>770</integer>
  <key>capHeight</key>
  <integer>750</integer>
  <key>descender</key>
  <integer>-249</integer>
  <key>italicAngle</key>
  <real>-15.0</real>
  <key>styleName</key>
  <string>Italic</string>
  <key>xHeight</key>
  <integer>550</integer>
</dict>
</plist>`;

  it('reads the metrics, flipping the italic angle into the app’s sign', () => {
    expect(readUfoFontInfo(plist)).toEqual({
      format: 'UFO',
      masters: [
        {
          name: 'Italic',
          metrics: { ascender: 770, capHeight: 750, descender: -249, italicAngle: 15, xHeight: 550 },
        },
      ],
    });
  });
});

function sheetState(): SheetState {
  return {
    rowCount: 4,
    metrics: 'different',
    rows: Array.from({ length: 6 }, newRowState),
    lines: defaultLineStyles(),
    header: { ...emptyHeaderText(), left: 'Brief' },
    page: { ...defaultPageSetup(), size: 'a4', orientation: 'portrait' },
  };
}

describe('readUpload', () => {
  it('tells a config, a Glyphs file and a UFO fontinfo apart by content', () => {
    expect(readUpload('x.txt', bytes(writeSheetFile(sheetState()))).kind).toBe('sheet');
    const glyphs = readUpload('renamed.txt', bytes(GLYPHS));
    expect(glyphs.kind === 'font' && glyphs.source.format).toBe('Glyphs');
    const ufo = readUpload('fontinfo.plist', bytes('<?xml version="1.0"?><plist><dict><key>capHeight</key><integer>700</integer></dict></plist>'));
    expect(ufo.kind === 'font' && ufo.source.format).toBe('UFO');
  });

  it('refuses compiled fonts, pointing to the source', () => {
    for (const tag of ['\0\x01\0\0', 'OTTO', 'true', 'ttcf', 'wOFF', 'wOF2']) {
      expect(() => readUpload('a.otf', bytes(`${tag}rest`))).toThrow(/Glyphs file or UFO/);
    }
  });

  it('refuses JSON that isn’t a config', () => {
    expect(() => readUpload('other.json', bytes('{"a": 1}'))).toThrow(/config file/);
  });

  it('refuses a font with no cap height', () => {
    const text = '{.formatVersion = 3; metrics = ({type = ascender;}); fontMaster = ({metricValues = ({pos = 800;});});}';
    expect(() => readUpload('a.glyphs', bytes(text))).toThrow(/cap height/);
  });

  it('refuses anything else', () => {
    expect(() => readUpload('a.png', bytes('\u0089PNG'))).toThrow(/isn’t one/);
  });
});

describe('mastersAgree', () => {
  it('is true only when every master has the same metrics', () => {
    const a = { name: 'A', metrics: { capHeight: 700 } };
    expect(mastersAgree([a, { name: 'B', metrics: { capHeight: 700 } }])).toBe(true);
    expect(mastersAgree([a, { name: 'B', metrics: { capHeight: 710 } }])).toBe(false);
    expect(mastersAgree([a, { name: 'B', metrics: { capHeight: 700, xHeight: 500 } }])).toBe(false);
  });
});

describe('applyFontMetrics', () => {
  it('switches on the lines the font has and off those it hasn’t', () => {
    const state = newRowState();
    applyFontMetrics(state, { capHeight: 830, descender: -249, ascender: 1000 });
    expect(state.units).toEqual({ ascender: 1000, capHeight: 830, xHeight: 500, descender: -249 });
    expect(state.visible).toEqual({
      ascender: true,
      capHeight: true,
      xHeight: false,
      baseline: true,
      descender: true,
    });
    expect(state.slant.enabled).toBe(false);
  });

  it('switches off a line out of order, keeping its value', () => {
    const state = newRowState();
    applyFontMetrics(state, { capHeight: 600, ascender: 600, xHeight: 426, descender: -160 });
    expect(state.units.ascender).toBe(600);
    expect(state.visible.ascender).toBe(false);
    expect(state.visible.xHeight).toBe(true);
  });

  it('treats 0 as no value, and takes a non-zero italic angle', () => {
    const state = newRowState();
    applyFontMetrics(state, { capHeight: 700, xHeight: 0, italicAngle: 15 });
    expect(state.visible.xHeight).toBe(false);
    expect(state.slant).toEqual({ enabled: true, angle: 15 });
  });
});

describe('sheet file', () => {
  it('round-trips the sheet', () => {
    const sheet = sheetState();
    sheet.rows[2]!.units.xHeight = null;
    expect(readSheetFile(JSON.parse(writeSheetFile(sheet)))).toEqual(sheet);
  });

  it('names the first value it can’t use', () => {
    const file = JSON.parse(writeSheetFile(sheetState()));
    file.rows[1].units.capHeight = 'tall';
    expect(() => readSheetFile(file)).toThrow(/rows\[1\]\.units\.capHeight/);
  });

  it('refuses a row count out of range and a file from a newer version', () => {
    const file = JSON.parse(writeSheetFile(sheetState()));
    expect(() => readSheetFile({ ...file, rowCount: 7 })).toThrow(/rowCount/);
    expect(() => readSheetFile({ ...file, version: 2 })).toThrow(SheetFileError);
  });
});

/** A one-entry zip, stored or deflated, its local sizes left to the directory. */
async function zip(path: string, text: string, deflate: boolean): Promise<ArrayBuffer> {
  const raw = new TextEncoder().encode(text);
  const data = deflate
    ? new Uint8Array(
        await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer(),
      )
    : raw;
  const name = new TextEncoder().encode(path);
  const out = new DataView(new ArrayBuffer(30 + name.length + data.length + 46 + name.length + 22));
  const bytesOut = new Uint8Array(out.buffer);
  out.setUint32(0, 0x04034b50, true);
  out.setUint16(8, deflate ? 8 : 0, true);
  out.setUint16(26, name.length, true);
  bytesOut.set(name, 30);
  bytesOut.set(data, 30 + name.length);
  const dir = 30 + name.length + data.length;
  out.setUint32(dir, 0x02014b50, true);
  out.setUint16(dir + 10, deflate ? 8 : 0, true);
  out.setUint32(dir + 20, data.length, true);
  out.setUint32(dir + 24, raw.length, true);
  out.setUint16(dir + 28, name.length, true);
  out.setUint32(dir + 42, 0, true);
  bytesOut.set(name, dir + 46);
  const end = dir + 46 + name.length;
  out.setUint32(end, 0x06054b50, true);
  out.setUint16(end + 8, 1, true);
  out.setUint16(end + 10, 1, true);
  out.setUint32(end + 12, 46 + name.length, true);
  out.setUint32(end + 16, dir, true);
  return out.buffer;
}

describe('readZipEntry', () => {
  const plist = '<plist><dict><key>capHeight</key><integer>700</integer></dict></plist>';

  it('unpacks a deflated or stored entry', async () => {
    for (const deflate of [true, false]) {
      const archive = await zip('Face.ufo/fontinfo.plist', plist, deflate);
      expect(isZip(archive)).toBe(true);
      const entry = await readZipEntry(archive, (p) => p.endsWith('fontinfo.plist'));
      expect(entry!.path).toBe('Face.ufo/fontinfo.plist');
      expect(new TextDecoder().decode(entry!.bytes)).toBe(plist);
    }
  });

  it('returns null when nothing matches', async () => {
    const archive = await zip('Face.ufo/lib.plist', plist, true);
    expect(await readZipEntry(archive, (p) => p.endsWith('fontinfo.plist'))).toBeNull();
  });
});
