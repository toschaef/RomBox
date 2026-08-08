describe("platform index handler factory", () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      configurable: true,
    });
    jest.resetModules();
  });

  it("should instantiate MacHandler when platform is darwin", () => {
    Object.defineProperty(process, "platform", {
      value: "darwin",
      configurable: true,
    });
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { osHandler } = require("../../../../src/main/platform");
    expect(osHandler.constructor.name).toBe("MacHandler");
    expect(osHandler.getPlatform()).toBe("darwin");
    expect(osHandler.getPlatformId()).toBe("macos");
  });

  it("should instantiate WinHandler when platform is win32", () => {
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { osHandler } = require("../../../../src/main/platform");
    expect(osHandler.constructor.name).toBe("WinHandler");
    expect(osHandler.getPlatform()).toBe("win32");
    expect(osHandler.getPlatformId()).toBe("windows");
  });

  it("should throw error when platform is unsupported (e.g. linux)", () => {
    Object.defineProperty(process, "platform", {
      value: "linux",
      configurable: true,
    });
    jest.resetModules();
    expect(() => {
      require("../../../../src/main/platform");
    }).toThrow("Unsupported OS: linux");
  });
});
