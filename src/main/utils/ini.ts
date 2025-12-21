import fs from 'fs';

export const IniEditor = {
  updateIni: (filePath: string, updates: Record<string, Record<string, string>>) => {
    let lines: string[] = [];
    
    if (fs.existsSync(filePath)) {
      lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
    }

    const newLines: string[] = [];
    let currentSection = '';
    const processedKeys = new Set<string>();

    // update keys
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        currentSection = trimmed.slice(1, -1);
        newLines.push(line);
        continue;
      }

      const match = line.match(/^([^=]+)=(.*)/);
      if (match && currentSection) {
        const key = match[1].trim();
        if (updates[currentSection] && updates[currentSection][key] !== undefined) {
          const val = updates[currentSection][key];
          newLines.push(`${key} = ${val}`);
          processedKeys.add(`${currentSection}.${key}`);
        } else {
          newLines.push(line);
        }
      } else {
        newLines.push(line);
      }
    }

    // add missing keys
    for (const [section, keys] of Object.entries(updates)) {
      const missingKeys = Object.entries(keys).filter(([k]) => !processedKeys.has(`${section}.${k}`));
      
      if (missingKeys.length > 0) {
        const header = `[${section}]`;
        if (!newLines.includes(header)) {
             newLines.push('');
             newLines.push(header);
        }
        
        // append keys
        if (!newLines[newLines.length - 1].includes(header)) {
             newLines.push(header); 
        }

        for (const [k, v] of missingKeys) {
          newLines.push(`${k} = ${v}`);
        }
      }
    }

    fs.writeFileSync(filePath, newLines.join('\n'));
  }
};