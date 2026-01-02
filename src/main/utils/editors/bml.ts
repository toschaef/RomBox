import fs from "fs";

type BmlLine = { raw: string; indent: number; text: string };

function parseLines(text: string): BmlLine[] {
  const lines = text.split(/\r?\n/);
  return lines.map((raw) => {
    const m = raw.match(/^(\s*)(.*)$/);
    const indent = m ? m[1].length : 0;
    const text = m ? m[2] : raw;
    return { raw, indent, text };
  });
}

const KV_RE = /^([^:]+):\s*(.*)$/;

function isHeader(line: BmlLine) {
  const m = line.text.match(KV_RE);
  if (!m) return false;
  const key = m[1].trim();
  const val = m[2];
  return key.length > 0 && (val === "" || val.trim() === "");
}

function keyOf(line: BmlLine): string | null {
  const m = line.text.match(KV_RE);
  if (!m) return null;
  return m[1].trim();
}

function setLineValue(line: BmlLine, value: string): string {
  const m = line.text.match(KV_RE);
  if (!m) return line.raw;
  const key = m[1].trim();
  const pad = " ".repeat(line.indent);
  return `${pad}${key}: ${value}`;
}

function findBlockRange(lines: BmlLine[], path: string[]): { headerIndex: number; start: number; end: number } | null {
  let searchStart = 0;
  let currentHeaderIndex = -1;
  let currentIndent = -1;

  for (let depth = 0; depth < path.length; depth++) {
    const target = path[depth];
    let found = -1;

    for (let i = searchStart; i < lines.length; i++) {
      const ln = lines[i];
      if (!isHeader(ln)) continue;

      const k = keyOf(ln);
      if (k !== target) continue;

      if (depth === 0) {
        found = i;
        break;
      } else {
        if (ln.indent > currentIndent) {
          found = i;
          break;
        }
      }
    }

    if (found === -1) return null;

    currentHeaderIndex = found;
    currentIndent = lines[found].indent;
    searchStart = found + 1;
  }

  const headerIndent = lines[currentHeaderIndex].indent;
  const start = currentHeaderIndex + 1;

  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (lines[i].indent <= headerIndent && isHeader(lines[i])) {
      end = i;
      break;
    }
    if (lines[i].indent <= headerIndent && lines[i].text.trim() !== "") {
      end = i;
      break;
    }
  }

  return { headerIndex: currentHeaderIndex, start, end };
}

function ensureBlock(lines: BmlLine[], path: string[]): { headerIndex: number; start: number; end: number } {
  const existing = findBlockRange(lines, path);
  if (existing) return existing;

  let indent = 0;
  if (path.length > 1) {
    const parent = findBlockRange(lines, path.slice(0, -1));
    if (parent) indent = lines[parent.headerIndex].indent + 2;
  }

  if (lines.length && lines[lines.length - 1].raw.trim() !== "") {
    lines.push({ raw: "", indent: 0, text: "" });
  }

  const parentExists = path.length > 1 && findBlockRange(lines, path.slice(0, -1));
  const chain = parentExists ? [path[path.length - 1]] : path;

  let currentIndent = parentExists ? indent : 0;
  for (const part of chain) {
    lines.push({ raw: `${" ".repeat(currentIndent)}${part}:`, indent: currentIndent, text: `${part}:` });
    currentIndent += 2;
  }

  const outText = lines.map((l) => l.raw).join("\n");
  const reparsed = parseLines(outText);
  const got = findBlockRange(reparsed, path);
  if (!got) throw new Error(`BmlEditor.ensureBlock failed to create path: ${path.join(" > ")}`);
  return got;
}

export const BmlEditor = {
  updateBml(filePath: string, blockPath: string[], updates: Record<string, string>) {
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
    let lines = parseLines(existing);

    const block = ensureBlock(lines, blockPath);

    const seen = new Set<string>();
    let replaced = 0;

    for (let i = block.start; i < block.end; i++) {
      const ln = lines[i];
      const m = ln.text.match(KV_RE);
      if (!m) continue;

      const key = m[1].trim();
      if (updates[key] === undefined) continue;

      lines[i] = { ...ln, raw: setLineValue(ln, updates[key]) };
      seen.add(key);
      replaced++;
    }

    const missing = Object.entries(updates).filter(([k]) => !seen.has(k));
    if (missing.length) {
      const insertAt = block.end;
      const baseIndent = lines[block.headerIndex].indent + 2;

      const insertLines: BmlLine[] = missing.map(([k, v]) => ({
        indent: baseIndent,
        text: `${k}: ${v}`,
        raw: `${" ".repeat(baseIndent)}${k}: ${v}`,
      }));

      lines.splice(insertAt, 0, ...insertLines);
    }

    const out = lines.map((l) => l.raw).join("\n");
    fs.writeFileSync(filePath, out);

    console.log(
      `[BmlEditor] block="${blockPath.join(" > ")}" replaced=${replaced} appended=${missing.length} file=${filePath}`
    );
  },
};
