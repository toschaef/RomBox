import { spawnSync } from "child_process";
import { runSdlProbe } from "../../../../../src/main/emulators/azahar/sdlProbe";

jest.mock("child_process", () => ({
  spawnSync: jest.fn()
}));

describe("runSdlProbe", () => {
  const mockSpawnSync = spawnSync as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return successfully parsed learned data on valid stdout", () => {
    const mockOutput = {
      ok: true,
      guid: "some-guid",
      port: 0,
      binds: {
        button_a: { kind: "button", button: 1 }
      }
    };

    mockSpawnSync.mockReturnValue({
      stdout: JSON.stringify(mockOutput),
      stderr: "",
      status: 0
    });

    const result = runSdlProbe({
      helperPath: "/path/to/helper",
      preferredGuid: "preferred-guid"
    });

    expect(mockSpawnSync).toHaveBeenCalledWith("/path/to/helper", ["--guid", "preferred-guid"], {
      encoding: "utf-8",
      timeout: 1500,
      windowsHide: true
    });

    expect(result.learned).toEqual(mockOutput);
    expect(result.rawStdout).toBe(JSON.stringify(mockOutput));
    expect(result.rawStderr).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("should return null learned data if stdout has invalid json syntax", () => {
    mockSpawnSync.mockReturnValue({
      stdout: "invalid-json-output",
      stderr: "some warning",
      status: 0
    });

    const result = runSdlProbe({ helperPath: "/path/to/helper" });

    expect(result.learned).toBeNull();
    expect(result.rawStdout).toBe("invalid-json-output");
    expect(result.rawStderr).toBe("some warning");
  });

  it("should return null learned data if ok field is false in JSON payload", () => {
    const mockOutput = { ok: false, message: "device not found" };
    mockSpawnSync.mockReturnValue({
      stdout: JSON.stringify(mockOutput),
      stderr: "",
      status: 1
    });

    const result = runSdlProbe({ helperPath: "/path/to/helper" });

    expect(result.learned).toBeNull();
    expect(result.exitCode).toBe(1);
  });

  it("should return null learned data if spawned command exits with failure and empty stdout", () => {
    mockSpawnSync.mockReturnValue({
      stdout: "",
      stderr: "Fatal process error",
      status: 255
    });

    const result = runSdlProbe({ helperPath: "/path/to/helper" });

    expect(result.learned).toBeNull();
    expect(result.rawStderr).toBe("Fatal process error");
    expect(result.exitCode).toBe(255);
  });

  it("should not override the child's env by default", () => {
    mockSpawnSync.mockReturnValue({ stdout: "", stderr: "", status: 0 });

    runSdlProbe({ helperPath: "/path/to/helper" });

    const [, , options] = mockSpawnSync.mock.calls[0];
    expect(options.env).toBeUndefined();
  });

  it("should disable SDL's HIDAPI/RawInput drivers when forceDirectInputBackend is set", () => {
    // SDL's HIDAPI drivers parse a device's raw vendor protocol themselves and
    // report buttons/axes in an order that has no relation to what Win32
    // DirectInput reports for the same device - Mesen2 reads gamepads through
    // plain DirectInput, so its probe must be forced onto that same backend.
    mockSpawnSync.mockReturnValue({ stdout: "", stderr: "", status: 0 });

    runSdlProbe({ helperPath: "/path/to/helper", forceDirectInputBackend: true });

    const [, , options] = mockSpawnSync.mock.calls[0];
    expect(options.env.SDL_JOYSTICK_HIDAPI).toBe("0");
    expect(options.env.SDL_JOYSTICK_RAWINPUT).toBe("0");
    // the rest of the process env is preserved, not replaced
    expect(options.env.PATH ?? options.env.Path).toBe(process.env.PATH ?? process.env.Path);
  });
});
