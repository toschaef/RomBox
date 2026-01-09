import { spawnSync } from "child_process";

export type AzaharLearnedSDL = {
  ok: boolean;
  guid: string;
  port: number;
  binds: Record<string,
    | { kind: "button"; button: number }
    | { kind: "axis"; axis: number; direction: "+" | "-"; threshold: number }
    | { kind: "hat"; hat: number; direction: "up" | "down" | "left" | "right" }
  >;
  sticks?: {
    circle_pad?: string;
    c_stick?: string;
  };
};


function safeJsonParse<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export function runAzaharSdlProbe(args: {
  helperPath: string;
  timeoutMs?: number;
  preferredGuid?: string;
}): { learned: AzaharLearnedSDL | null; rawStdout: string; rawStderr: string; exitCode: number | null } {
  const { helperPath, timeoutMs = 1500, preferredGuid } = args;

  const helperArgs: string[] = [];
  if (preferredGuid) helperArgs.push("--guid", preferredGuid);

  const res = spawnSync(helperPath, helperArgs, {
    encoding: "utf-8",
    timeout: timeoutMs,
    windowsHide: true,
  });

  const stdout = (res.stdout ?? "").trim();
  const stderr = (res.stderr ?? "").trim();

  const parsed = safeJsonParse<AzaharLearnedSDL>(stdout);
  if (!parsed || !parsed.ok || !parsed.guid || typeof parsed.port !== "number" || !parsed.binds) {
    return { learned: null, rawStdout: stdout, rawStderr: stderr, exitCode: res.status };
  }

  return { learned: parsed, rawStdout: stdout, rawStderr: stderr, exitCode: res.status };
}