import fs from "fs";
import path from "path";

type IniUpdates = Record<string, Record<string, string>>;
type IniDeletes = Record<string, string[]>;

const ROOT = "";

const sectionHeaderRe = /^\s*\[([^\]]+)\]\s*$/;
const kvRe = /^\s*([^=;#]+?)\s*=\s*(.*?)\s*$/;

function ensureParentDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

type IniWriteFormat = "compact" | "spaced";

function formatLine(key: string, val: string, fmt: IniWriteFormat) {
  return fmt === "compact" ? `${key}=${val}` : `${key} = ${val}`;
}

export const IniEditor = {
  updateIni(filePath: string, updates: IniUpdates, opts?: { format?: IniWriteFormat }) {
    const format: IniWriteFormat = opts?.format ?? "spaced"; // default keeps current behavior

    const existing = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, "utf-8").split(/\r?\n/)
      : [];

    const out: string[] = [];
    let currentSection = ROOT;

    const processed = new Set<string>();

    for (const line of existing) {
      const headerMatch = line.match(sectionHeaderRe);
      if (headerMatch) {
        currentSection = headerMatch[1].trim();
        out.push(line);
        continue;
      }

      const kvMatch = line.match(kvRe);
      if (kvMatch) {
        const key = kvMatch[1].trim();

        const sectionUpdates = updates[currentSection];
        if (sectionUpdates && sectionUpdates[key] !== undefined) {
          const val = sectionUpdates[key];
          out.push(formatLine(key, val, format));
          processed.add(`${currentSection}.${key}`);
        } else {
          const rootUpdates = updates[ROOT];
          if (currentSection === ROOT && rootUpdates && rootUpdates[key] !== undefined) {
            const val = rootUpdates[key];
            out.push(formatLine(key, val, format));
            processed.add(`${ROOT}.${key}`);
          } else {
            out.push(line);
          }
        }
      } else {
        out.push(line);
      }
    }

    const findSectionStart = (section: string) => {
      for (let i = 0; i < out.length; i++) {
        const m = out[i].match(sectionHeaderRe);
        if (m && m[1]!.trim() === section) return i;
      }
      return -1;
    };

    const findSectionEndIndex = (section: string) => {
      if (section === ROOT) return out.length;
      const header = `[${section}]`;

      const start = findSectionStart(section);
      if (start === -1) return -1;

      for (let i = start + 1; i < out.length; i++) {
        if (sectionHeaderRe.test(out[i])) return i;
      }
      return out.length;
    };

    for (const [section, keys] of Object.entries(updates)) {
      for (const [k, v] of Object.entries(keys)) {
        const id = `${section}.${k}`;
        if (processed.has(id)) continue;

        if (section === ROOT) {
          out.push(formatLine(k, v, format));
          processed.add(id);
          continue;
        }

        const header = `[${section}]`;
        let end = findSectionEndIndex(section);

        if (end === -1) {
          if (out.length && out[out.length - 1].trim() !== "") out.push("");
          out.push(header);
          end = out.length;
        }

        out.splice(end, 0, formatLine(k, v, format));
        processed.add(id);
      }
    }

    ensureParentDir(filePath);
    fs.writeFileSync(filePath, out.join("\n"), "utf-8");
  },

  deleteKeys(filePath: string, deletes: IniDeletes) {
    if (!fs.existsSync(filePath)) return;

    const existing = fs.readFileSync(filePath, "utf-8").split(/\r?\n/);
    const out: string[] = [];
    let currentSection = ROOT;

    const shouldDelete = (section: string, key: string) => {
      const list = deletes[section] ?? (section === ROOT ? deletes[ROOT] : undefined);
      return !!list && list.includes(key);
    };

    for (const line of existing) {
      const headerMatch = line.match(sectionHeaderRe);
      if (headerMatch) {
        currentSection = headerMatch[1].trim();
        out.push(line);
        continue;
      }

      const kvMatch = line.match(kvRe);
      if (kvMatch) {
        const key = kvMatch[1].trim();
        if (shouldDelete(currentSection, key)) {
          continue;
        }
      }

      out.push(line);
    }

    ensureParentDir(filePath);
    fs.writeFileSync(filePath, out.join("\n"), "utf-8");
  },

  resetSectionKeys(filePath: string, section: string, keys: string[]) {
    this.deleteKeys(filePath, { [section]: keys });
  },

  overwriteSection(
    filePath: string,
    section: string,
    updates: Record<string, string>,
    opts?: { format?: IniWriteFormat }
  ) {
    const format: IniWriteFormat = opts?.format ?? "spaced";

    const existing = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, "utf-8").split(/\r?\n/)
      : [];

    const out: string[] = [];

    const findSectionStart = (lines: string[], sec: string) => {
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(sectionHeaderRe);
        if (m && m[1]!.trim() === sec) return i;
      }
      return -1;
    };

    const findSectionEnd = (lines: string[], startIdx: number) => {
      for (let i = startIdx + 1; i < lines.length; i++) {
        if (sectionHeaderRe.test(lines[i])) return i;
      }
      return lines.length;
    };

    const start = findSectionStart(existing, section);
    const keys = Object.keys(updates).sort();
    const newLines = keys.map((k) => formatLine(k, updates[k]!, format));

    if (start === -1) {
      out.push(...existing);
      if (out.length && out[out.length - 1].trim() !== "") out.push("");
      out.push(`[${section}]`);
      out.push(...newLines);
    } else {
      const end = findSectionEnd(existing, start);
      out.push(...existing.slice(0, start));
      out.push(existing[start]!);
      out.push(...newLines);
      out.push(...existing.slice(end));
    }

    ensureParentDir(filePath);
    fs.writeFileSync(filePath, out.join("\n"), "utf-8");
  },
};