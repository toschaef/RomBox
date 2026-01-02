import fs from "fs";

type IniUpdates = Record<string, Record<string, string>>;

const ROOT = "";

export const IniEditor = {
  updateIni(filePath: string, updates: IniUpdates) {
    const existing = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, "utf-8").split(/\r?\n/)
      : [];

    const out: string[] = [];
    let currentSection = ROOT;

    const processed = new Set<string>();

    const sectionHeaderRe = /^\s*\[([^\]]+)\]\s*$/;
    const kvRe = /^\s*([^=;#]+?)\s*=\s*(.*?)\s*$/;
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
          out.push(`${key} = ${val}`);
          processed.add(`${currentSection}.${key}`);
        } else {
          const rootUpdates = updates[ROOT];
          if (currentSection === ROOT && rootUpdates && rootUpdates[key] !== undefined) {
            const val = rootUpdates[key];
            out.push(`${key} = ${val}`);
            processed.add(`${ROOT}.${key}`);
          } else {
            out.push(line);
          }
        }
      } else {
        out.push(line);
      }
    }

    const findSectionEndIndex = (section: string) => {
      if (section === ROOT) return out.length;
      const header = `[${section}]`;

      const start = out.findIndex((l) => l.trim() === header);
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
          out.push(`${k} = ${v}`);
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

        out.splice(end, 0, `${k} = ${v}`);
        processed.add(id);
      }
    }

    fs.writeFileSync(filePath, out.join("\n"));
  },
};
