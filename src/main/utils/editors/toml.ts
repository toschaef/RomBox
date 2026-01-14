import fs from "fs";

export const TomlEditor = {
  updateTomlKV(filePath: string, updates: Record<string, string>) {
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
    const lines = existing.split(/\r?\n/);

    const out: string[] = [];
    const seen = new Set<string>();
    let replaced = 0;

    const kvRe = /^\s*([A-Za-z0-9_.-]+)\s*=\s*([^#]*?)(\s*#.*)?$/;

    for (const line of lines) {
      const m = line.match(kvRe);
      if (!m) {
        out.push(line);
        continue;
      }

      const key = m[1].trim();
      const comment = m[3] ?? "";

      if (updates[key] !== undefined) {
        out.push(`${key} = ${updates[key]}${comment}`);
        seen.add(key);
        replaced++;
      } else {
        out.push(line);
      }
    }

    const missing = Object.entries(updates).filter(([k]) => !seen.has(k));
    if (missing.length) {
      if (out.length && out[out.length - 1].trim() !== "") out.push("");
      for (const [k, v] of missing) out.push(`${k} = ${v}`);
    }

    fs.writeFileSync(filePath, out.join("\n"));
  },

  updateTomlTableKV(filePath: string, table: string, updates: Record<string, string>) {
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
    const lines = existing.split(/\r?\n/);

    const out: string[] = [];
    const seen = new Set<string>();
    let replaced = 0;
    let inTable = false;
    let tableFound = false;

    const headerRe = /^\s*\[([^\]]+)\]\s*$/;
    const kvRe = /^\s*([A-Za-z0-9_.-]+)\s*=\s*([^#]*?)(\s*#.*)?$/;

    const flushMissing = () => {
      const missing = Object.entries(updates).filter(([k]) => !seen.has(k));
      for (const [k, v] of missing) out.push(`${k} = ${v}`);
      return missing.length;
    };

    let appendedInside = 0;

    for (const line of lines) {
      const hm = line.match(headerRe);
      if (hm) {
        if (inTable) {
          appendedInside += flushMissing();
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
            replaced++;
            continue;
          }
        }
      }

      out.push(line);
    }

    if (inTable) {
      appendedInside += flushMissing();
    }

    if (!tableFound) {
      out.push("");
      out.push(`[${table}]`);
      for (const [k, v] of Object.entries(updates)) out.push(`${k} = ${v}`);
      appendedInside = Object.keys(updates).length;
    }

    fs.writeFileSync(filePath, out.join("\n"));
  },
};
