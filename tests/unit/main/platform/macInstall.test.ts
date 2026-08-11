// the macos install pipeline: dmg mounting, quarantine removal, ad-hoc signing
// and the wrapper script that makes bundled dylibs resolvable.
import path from "path";
import fs from "fs";
import { exec, execSync, spawn } from "child_process";

import { MacHandler } from "../../../../src/main/platform/MacHandler";
import { Extractor } from "../../../../src/main/utils/extractor";
import type { Game } from "../../../../src/shared/types";

jest.mock("child_process", () => ({
  exec: jest.fn(),
  execSync: jest.fn(),
  spawn: jest.fn(),
}));

jest.mock("../../../../src/main/utils/extractor", () => ({
  Extractor: { extractArchive: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock("os", () => ({ ...jest.requireActual("os"), homedir: () => "/mock/home" }));

const execMock = exec as unknown as jest.Mock;

/** promisify(exec) calls the node-style callback */
function execResolves(stdout = "") {
  execMock.mockImplementation((_cmd: string, cb: (e: unknown, r: unknown) => void) =>
    cb(null, { stdout, stderr: "" })
  );
}

function execRejects(message = "command failed") {
  execMock.mockImplementation((_cmd: string, cb: (e: unknown) => void) => cb(new Error(message)));
}

function commandsRun(): string[] {
  return execMock.mock.calls.map((c) => c[0] as string);
}

let handler: MacHandler;

beforeEach(() => {
  jest.clearAllMocks();
  handler = new MacHandler();
  execResolves();
});

afterEach(() => jest.restoreAllMocks());

describe("extractArchive", () => {
  it("delegates non-dmg archives to the extractor", async () => {
    await handler.extractArchive("/tmp/thing.zip", "/dest");
    expect(Extractor.extractArchive).toHaveBeenCalledWith("/tmp/thing.zip", "/dest");
    expect(execMock).not.toHaveBeenCalled();
  });

  it("mounts a dmg, copies each app bundle out, then unmounts", async () => {
    jest.spyOn(fs, "readdirSync").mockReturnValue(["Dolphin.app"] as never);
    jest.spyOn(fs, "lstatSync").mockReturnValue({
      isDirectory: () => false,
      isSymbolicLink: () => false,
    } as fs.Stats);
    jest.spyOn(fs, "existsSync").mockReturnValue(true);

    await handler.extractArchive("/tmp/dolphin.dmg", "/dest");

    const cmds = commandsRun();
    expect(cmds.some((c) => c.startsWith("hdiutil attach"))).toBe(true);
    expect(cmds.some((c) => c.includes('cp -R') && c.includes("Dolphin.app"))).toBe(true);
    expect(cmds.some((c) => c.startsWith("hdiutil detach"))).toBe(true);
  });

  it("fails when the dmg holds no app bundle", async () => {
    jest.spyOn(fs, "readdirSync").mockReturnValue([] as never);
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    await expect(handler.extractArchive("/tmp/empty.dmg", "/dest")).rejects.toThrow(
      /No .app bundle/
    );
  });

  it("unmounts even when copying fails", async () => {
    jest.spyOn(fs, "readdirSync").mockReturnValue(["A.app"] as never);
    jest.spyOn(fs, "lstatSync").mockReturnValue({
      isDirectory: () => false,
      isSymbolicLink: () => false,
    } as fs.Stats);
    jest.spyOn(fs, "existsSync").mockReturnValue(true);

    execMock.mockImplementation((cmd: string, cb: (e: unknown, r?: unknown) => void) => {
      if (cmd.startsWith("cp -R")) return cb(new Error("copy failed"));
      cb(null, { stdout: "", stderr: "" });
    });

    await expect(handler.extractArchive("/tmp/a.dmg", "/dest")).rejects.toBeDefined();
    expect(commandsRun().some((c) => c.startsWith("hdiutil detach"))).toBe(true);
  });
});

describe("installDependency", () => {
  it("copies the dependency out of the mounted dmg into the MacOS dir", async () => {
    execResolves("/dev/disk2s1  Apple_HFS  /Volumes/SDL2\n");
    jest.spyOn(fs, "readdirSync").mockImplementation((dir) =>
      String(dir).includes("Volumes") ? (["SDL2.framework"] as never) : ([] as never)
    );
    jest.spyOn(fs, "lstatSync").mockReturnValue({ isDirectory: () => false } as fs.Stats);
    jest.spyOn(fs, "statSync").mockReturnValue({ isDirectory: () => false } as fs.Stats);
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    const copyFile = jest.spyOn(fs.promises, "copyFile").mockResolvedValue(undefined);

    await handler.installDependency("/tmp/sdl.dmg", "/install", "SDL2.framework", "libSDL2.dylib");

    expect(commandsRun().some((c) => c.includes("hdiutil attach"))).toBe(true);
    expect(copyFile).toHaveBeenCalledWith(
      path.join("/Volumes/SDL2", "SDL2.framework"),
      path.join("/install", "libSDL2.dylib")
    );
    // the copied dylib is rewritten to load relative to the executable
    expect(commandsRun().some((c) => c.includes("install_name_tool"))).toBe(true);
  });

  it("fails when the dmg cannot be mounted", async () => {
    execResolves("no volume here");
    await expect(
      handler.installDependency("/tmp/x.dmg", "/install", "SDL2", "libSDL2.dylib")
    ).rejects.toThrow(/Could not mount DMG/);
  });

  it("fails when the dependency is absent from the dmg", async () => {
    execResolves("/Volumes/Empty\n");
    jest.spyOn(fs, "readdirSync").mockReturnValue([] as never);
    jest.spyOn(fs, "existsSync").mockReturnValue(true);

    await expect(
      handler.installDependency("/tmp/x.dmg", "/install", "SDL2.framework", "libSDL2.dylib")
    ).rejects.toThrow(/Could not find SDL2.framework/);
  });
});

describe("finalizeInstall", () => {
  it("does nothing when the binary is absent", async () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(false);
    await handler.finalizeInstall("/gone/binary", false);
    expect(execMock).not.toHaveBeenCalled();
  });

  it("removes quarantine and ad-hoc signs a plain binary", async () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "chmodSync").mockImplementation(() => undefined);

    await handler.finalizeInstall("/install/mesen", false);

    const cmds = commandsRun();
    expect(cmds.some((c) => c.includes("xattr") && c.includes("com.apple.quarantine"))).toBe(true);
    expect(cmds.some((c) => c.includes("codesign"))).toBe(true);
  });

  it("deep signs an app bundle", async () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "chmodSync").mockImplementation(() => undefined);
    jest.spyOn(fs.promises, "rename").mockResolvedValue(undefined);
    jest.spyOn(fs.promises, "writeFile").mockResolvedValue(undefined);

    await handler.finalizeInstall("/install/Mesen.app/Contents/MacOS/Mesen", false);

    expect(commandsRun().some((c) => c.includes("codesign") && c.includes("--deep"))).toBe(true);
  });

  it("writes a wrapper script that exports DYLD_LIBRARY_PATH", async () => {
    jest.spyOn(fs, "existsSync").mockImplementation((p) => !String(p).endsWith(".real"));
    jest.spyOn(fs, "chmodSync").mockImplementation(() => undefined);
    jest.spyOn(fs.promises, "rename").mockResolvedValue(undefined);
    const write = jest.spyOn(fs.promises, "writeFile").mockResolvedValue(undefined);

    await handler.finalizeInstall("/install/ares", true);

    const contents = write.mock.calls[0][1] as string;
    expect(contents).toContain("#!/bin/bash");
    expect(contents).toContain("DYLD_LIBRARY_PATH");
    expect(contents).toContain('exec "$DIR/ares.real"');
  });

  it("leaves an existing wrapper alone", async () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "chmodSync").mockImplementation(() => undefined);
    const rename = jest.spyOn(fs.promises, "rename").mockResolvedValue(undefined);

    await handler.finalizeInstall("/install/ares", true);
    expect(rename).not.toHaveBeenCalled();
  });

  it("survives a failed wrapper without throwing", async () => {
    jest.spyOn(fs, "existsSync").mockImplementation((p) => !String(p).endsWith(".real"));
    jest.spyOn(fs, "chmodSync").mockImplementation(() => undefined);
    jest.spyOn(fs.promises, "rename").mockRejectedValue(new Error("read-only fs"));

    await expect(handler.finalizeInstall("/install/ares", true)).resolves.toBeUndefined();
  });
});

describe("launchProcess", () => {
  it("spawns a plain binary detached with a utf-8 locale", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);

    handler.launchProcess("/install/mesen", ["--fullscreen"]);

    expect(spawn).toHaveBeenCalledWith(
      "/install/mesen",
      ["--fullscreen"],
      expect.objectContaining({
        detached: true,
        env: expect.objectContaining({ LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" }),
      })
    );
  });

  it("resolves the executable inside an app bundle when the path does not exist", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    handler.launchProcess("/install/Mesen.app/Contents/MacOS/WrongName", []);

    expect(spawn).toHaveBeenCalledWith(
      path.join("/install/Mesen.app", "Contents", "MacOS", "Mesen"),
      [],
      expect.any(Object)
    );
  });

  it("spawns the given path directly when it exists inside a bundle", () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);

    handler.launchProcess("/install/Mesen.app/Contents/MacOS/Mesen", []);

    expect(spawn).toHaveBeenCalledWith(
      "/install/Mesen.app/Contents/MacOS/Mesen",
      [],
      expect.any(Object)
    );
  });
});

describe("clearPlatformData", () => {
  it("removes the base directory of every emulator that exists", async () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    const rm = jest.spyOn(fs.promises, "rm").mockResolvedValue(undefined);

    await handler.clearPlatformData();

    // one per registered emulator
    expect(rm).toHaveBeenCalledTimes(7);
    expect(rm).toHaveBeenCalledWith(
      path.posix.join("/mock/home", "Library", "Application Support", "Dolphin"),
      { recursive: true, force: true }
    );
  });

  it("skips directories that are not there", async () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(false);
    const rm = jest.spyOn(fs.promises, "rm").mockResolvedValue(undefined);

    await handler.clearPlatformData();
    expect(rm).not.toHaveBeenCalled();
  });
});

describe("path accessors", () => {
  it("reports the platform", () => {
    expect(handler.getPlatformId()).toBe("macos");
    expect(handler.getPlatform()).toBe("darwin");
  });

  it("builds roots from the home directory", () => {
    const roots = handler.getRoots();
    expect(roots.home).toBe("/mock/home");
    expect(roots.appSupport).toBe(path.posix.join("/mock/home", "Library", "Application Support"));
    expect(roots.preferences).toBe(path.posix.join("/mock/home", "Library", "Preferences"));
  });

  it("resolves save paths per console", () => {
    const wii = { engineId: "dolphin", consoleId: "wii", filePath: "/roms/wii/g.iso" } as Game;
    const gc = { engineId: "dolphin", consoleId: "gc", filePath: "/roms/gc/g.iso" } as Game;

    expect(handler.getSavePath(wii)).toMatch(/Dolphin\/Wii$/);
    expect(handler.getSavePath(gc)).toMatch(/Dolphin\/GC$/);
  });

  it("returns null bios paths for emulators that need none", () => {
    expect(handler.getBiosPath("dolphin")).toBeNull();
    expect(handler.getBiosPath("duckstation")).toMatch(/DuckStation\/bios$/);
  });
});

describe("execSync failures", () => {
  it("propagates a chmod failure silently", async () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "chmodSync").mockImplementation(() => {
      throw new Error("EPERM");
    });

    await expect(handler.finalizeInstall("/install/mesen", false)).resolves.toBeUndefined();
    expect(execSync).not.toThrow();
  });

  it("does not throw when quarantine removal fails", async () => {
    jest.spyOn(fs, "existsSync").mockReturnValue(true);
    jest.spyOn(fs, "chmodSync").mockImplementation(() => undefined);
    execRejects("xattr: no such file");

    await expect(handler.finalizeInstall("/install/mesen", false)).resolves.toBeUndefined();
  });
});
