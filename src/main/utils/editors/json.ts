import fs from "fs";
import path from "path";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };

export type JsonEditorOptions = {
  createIfMissing?: boolean;
  prettySpaces?: number;
  trailingNewline?: boolean;
};

function ensureDirForFile(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readTextIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

function atomicWriteFile(filePath: string, content: string) {
  ensureDirForFile(filePath);

  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmp = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);

  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, filePath);
}

export const JsonEditor = {
  safeParse(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  },

  stringify(value: unknown, prettySpaces = 2, trailingNewline = false): string {
    const json = JSON.stringify(value ?? null, null, prettySpaces);
    return trailingNewline ? `${json}\n` : json;
  },


  exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  },

  read<T = unknown>(filePath: string, fallback?: T, opts: JsonEditorOptions = {}): T {
    const createIfMissing = opts.createIfMissing ?? false;
    const text = readTextIfExists(filePath);

    if (text == null) {
      if (createIfMissing) return (fallback ?? ({} as any)) as T;
      throw new Error(`JSON file not found: ${filePath}`);
    }

    if (createIfMissing && text.trim() === "") {
      return (fallback ?? ({} as any)) as T;
    }

    const parsed = JsonEditor.safeParse(text);
    if (parsed === null) throw new Error(`Invalid JSON in ${filePath}`);
    return parsed as T;
  },

  tryRead<T>(filePath: string, fallback: T): T {
    try {
      const text = readTextIfExists(filePath);
      if (text == null || text.trim() === "") return fallback;
      const parsed = JsonEditor.safeParse(text);
      return (parsed ?? fallback) as T;
    } catch {
      return fallback;
    }
  },

  write(filePath: string, value: unknown, opts: JsonEditorOptions = {}): void {
    const prettySpaces = opts.prettySpaces ?? 2;
    const trailingNewline = opts.trailingNewline ?? true;

    const content = JsonEditor.stringify(value, prettySpaces, trailingNewline);
    atomicWriteFile(filePath, content);
  },

  update<T>(
    filePath: string,
    fn: (current: T) => T,
    fallback?: T,
    opts: JsonEditorOptions & { createIfMissing?: boolean } = {}
  ): T {
    const createIfMissing = opts.createIfMissing ?? true;

    const current = JsonEditor.read<T>(
      filePath,
      fallback as T,
      { ...opts, createIfMissing }
    );

    const next = fn(current);
    JsonEditor.write(filePath, next, opts);
    return next;
  },

  updateStrict<T>(
    filePath: string,
    fn: (current: T) => T,
    opts: JsonEditorOptions = {}
  ): { ok: true; value: T } | { ok: false; reason: "missing" | "empty" | "invalid" } {
    const text = readTextIfExists(filePath);
    if (text == null) return { ok: false, reason: "missing" };
    if (text.trim() === "") return { ok: false, reason: "empty" };

    const parsed = JsonEditor.safeParse(text);
    if (parsed === null) return { ok: false, reason: "invalid" };

    const next = fn(parsed as T);
    JsonEditor.write(filePath, next, opts);
    return { ok: true, value: next };
  },

} as const;