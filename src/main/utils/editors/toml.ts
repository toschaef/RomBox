import fs from "fs";
import path from "path";

export const TomlEditor = {
  updateTomlKV(filePath: string, updates: Record<string, string>) {
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
    const lines = existing.split(/\r?\n/);

    const out: string[] = [];
    const seen = new Set<string>();

    const headerRe = /^\s*\[([^\]]+)\]\s*$/;
    const kvRe = /^\s*([A-Za-z0-9_.-]+)\s*=\s*([^#]*?)(\s*#.*)?$/;

    let firstHeader = lines.findIndex((l) => headerRe.test(l));
    if (firstHeader === -1) firstHeader = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = i < firstHeader ? line.match(kvRe) : null;
      if (!m) {
        out.push(line);
        continue;
      }

      const key = m[1].trim();
      const comment = m[3] ?? "";

      if (updates[key] !== undefined) {
        out.push(`${key} = ${updates[key]}${comment}`);
        seen.add(key);
      } else {
        out.push(line);
      }
    }

    const missing = Object.entries(updates).filter(([k]) => !seen.has(k));
    if (missing.length) {
      const insertAt = firstHeader;
      const added = missing.map(([k, v]) => `${k} = ${v}`);
      if (insertAt < out.length) added.push("");
      out.splice(insertAt, 0, ...added);
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, out.join("\n"));
  },

  updateTomlTableKV(filePath: string, table: string, updates: Record<string, string>) {
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
    const lines = existing.split(/\r?\n/);

    const out: string[] = [];
    const seen = new Set<string>();
    let inTable = false;
    let tableFound = false;

    const headerRe = /^\s*\[([^\]]+)\]\s*$/;
    const kvRe = /^\s*([A-Za-z0-9_.-]+)\s*=\s*([^#]*?)(\s*#.*)?$/;

    for (const line of lines) {
      const hm = line.match(headerRe);
      if (hm) {
        if (inTable) {
          const missing = Object.entries(updates).filter(([k]) => !seen.has(k));
          for (const [k, v] of missing) {
            out.push(`${k} = ${v}`);
            seen.add(k);
          }
        }

        const name = hm[1].trim();
        inTable = name === table;
        if (inTable) tableFound = true;

        out.push(line);
        continue;
      }

      if (inTable) {
        const m = line.match(kvRe);
        if (m) {
          const key = m[1].trim();
          const comment = m[3] ?? "";
          if (updates[key] !== undefined) {
            out.push(`${key} = ${updates[key]}${comment}`);
            seen.add(key);
            continue;
          }
        }
      }

      out.push(line);
    }

    if (inTable) {
      const missing = Object.entries(updates).filter(([k]) => !seen.has(k));
      for (const [k, v] of missing) {
        out.push(`${k} = ${v}`);
        seen.add(k);
      }
    }

    if (!tableFound) {
      out.push("");
      out.push(`[${table}]`);
      for (const [k, v] of Object.entries(updates)) out.push(`${k} = ${v}`);
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, out.join("\n"));
  },
};
