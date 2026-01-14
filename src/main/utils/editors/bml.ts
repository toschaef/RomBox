import fs from "fs";

type Line = { raw: string; indent: number; text: string };

function parseLines(text: string): Line[] {
  const lines = text.split(/\r?\n/);
  return lines.map((raw) => {
    const m = raw.match(/^(\s*)(.*)$/);
    const indent = m ? m[1].length : 0;
    const text = m ? m[2] : raw;
    return { raw, indent, text };
  });
}

const KV_RE = /^([^:]+):\s*(.*)$/;

function isKV(line: Line): boolean {
  return KV_RE.test(line.text);
}

function kvKey(line: Line): string | null {
  const m = line.text.match(KV_RE);
  return m ? m[1].trim() : null;
}

function setKV(line: Line, value: string): string {
  const m = line.text.match(KV_RE);
  if (!m) return line.raw;
  const key = m[1].trim();
  return `${" ".repeat(line.indent)}${key}: ${value}`;
}

function isTopSectionHeader(line: Line): boolean {
  const t = line.text.trim();
  if (!t) return false;
  if (line.indent !== 0) return false;
  return !t.includes(":");
}

function sectionName(line: Line): string | null {
  return isTopSectionHeader(line) ? line.text.trim() : null;
}

function findTopSectionRange(lines: Line[], name: string) {
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const n = sectionName(lines[i]);
    if (n === name) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) return null;

  const start = headerIndex + 1;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (isTopSectionHeader(lines[i])) {
      end = i;
      break;
    }
  }

  return { headerIndex, start, end };
}

function ensureTopSection(lines: Line[], name: string) {
  const existing = findTopSectionRange(lines, name);
  if (existing) return existing;

  if (lines.length && lines[lines.length - 1].raw.trim() !== "") {
    lines.push({ raw: "", indent: 0, text: "" });
  }

  const headerIndex = lines.length;
  lines.push({ raw: name, indent: 0, text: name });

  const reparsed = parseLines(lines.map((l) => l.raw).join("\n"));
  const got = findTopSectionRange(reparsed, name);
  if (!got) throw new Error(`Failed to create section "${name}"`);
  return got;
}

export const BmlEditor = {
  updateBml(filePath: string, blockPath: readonly string[], updates: Record<string, string>) {
    if (blockPath.length !== 1) {
      throw new Error(`BmlEditor.updateBml only supports top-level sections; got "${blockPath.join(" > ")}"`);
    }

    const section = blockPath[0];
    const existingText = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
    let lines = parseLines(existingText);

    const sec = ensureTopSection(lines, section);

    const seen = new Set<string>();
    let replaced = 0;

    for (let i = sec.start; i < sec.end; i++) {
      const ln = lines[i];
      if (!isKV(ln)) continue;

      const key = kvKey(ln);
      if (!key) continue;

      const next = updates[key];
      if (next === undefined) continue;

      lines[i] = { ...ln, raw: setKV(ln, next) };
      replaced++;
    }

    const toRemove: number[] = [];
    seen.clear();

    for (let i = sec.start; i < sec.end; i++) {
      const ln = lines[i];
      if (!isKV(ln)) continue;

      const key = kvKey(ln);
      if (!key) continue;

      if (seen.has(key)) {
        toRemove.push(i);
      } else {
        seen.add(key);
      }
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      lines.splice(toRemove[i], 1);
    }

    const reparsed = parseLines(lines.map((l) => l.raw).join("\n"));
    const sec2 = findTopSectionRange(reparsed, section);
    if (!sec2) throw new Error(`Section "${section}" vanished after dedupe`);
    lines = reparsed;

    const present = new Set<string>();
    for (let i = sec2.start; i < sec2.end; i++) {
      const ln = lines[i];
      if (!isKV(ln)) continue;
      const key = kvKey(ln);
      if (key) present.add(key);
    }

    const missing = Object.entries(updates).filter(([k]) => !present.has(k));
    if (missing.length) {
      const insertAt = sec2.end;
      const baseIndent = 2;

      const insertLines: Line[] = missing.map(([k, v]) => ({
        indent: baseIndent,
        text: `${k}: ${v}`,
        raw: `${" ".repeat(baseIndent)}${k}: ${v}`,
      }));

      lines.splice(insertAt, 0, ...insertLines);
    }

    fs.writeFileSync(filePath, lines.map((l) => l.raw).join("\n"), "utf-8");
  },
};