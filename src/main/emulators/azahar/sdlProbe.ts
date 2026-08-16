import { spawnSync } from "child_process";

export type AzaharLearnedSDL = {
  ok: boolean;
  guid: string;
  name?: string;
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

export function runSdlProbe(args: {
  helperPath: string;
  timeoutMs?: number;
  preferredGuid?: string;
  listen?: boolean;
  deviceIndex?: number;
  forceDirectInputBackend?: boolean;
}): { learned: AzaharLearnedSDL | null; rawStdout: string; rawStderr: string; exitCode: number | null } {
  const { helperPath, timeoutMs = 1500, preferredGuid, listen, deviceIndex, forceDirectInputBackend } = args;

  const helperArgs: string[] = [];
  if (preferredGuid) helperArgs.push("--guid", preferredGuid);
  if (deviceIndex !== undefined) helperArgs.push("--index", String(deviceIndex));
  if (listen) helperArgs.push("--listen");

  const res = spawnSync(helperPath, helperArgs, {
    encoding: "utf-8",
    timeout: timeoutMs,
    windowsHide: true,
    ...(forceDirectInputBackend
      ? { env: { ...process.env, SDL_JOYSTICK_HIDAPI: "0", SDL_JOYSTICK_RAWINPUT: "0" } }
      : {}),
  });

  const stdout = (res.stdout ?? "").trim();
  const stderr = (res.stderr ?? "").trim();

  const parsed = safeJsonParse<AzaharLearnedSDL>(stdout);
  
  if (listen) {
      return { learned: null, rawStdout: stdout, rawStderr: stderr, exitCode: res.status };
  }

  if (!parsed || !parsed.ok || !parsed.guid || typeof parsed.port !== "number" || !parsed.binds) {
    return { learned: null, rawStdout: stdout, rawStderr: stderr, exitCode: res.status };
  }

  return { learned: parsed, rawStdout: stdout, rawStderr: stderr, exitCode: res.status };
}