import { resolveConsoleBindings } from "../../src/main/utils/resolveConsoleBindings";
import { createDefaultProfileShape } from "../../src/shared/controls/layoutDefaults";
import type { ControlsProfile, AnyConsoleLayout } from "../../src/shared/types/controls";

describe("resolveConsoleBindings", () => {
  let mockProfile: ControlsProfile;

  beforeEach(() => {
    mockProfile = {
      id: "profile-id",
      name: "Default Profile",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: true,
      // preferredDevice: "keyboard",
      ...createDefaultProfileShape(),
    };
  });

  it("should return consoleLayout.bindings if they exist", async () => {
    const mockConsoleLayout: AnyConsoleLayout = {
      consoleId: "nes",
      name: "NES",
      bindings: {
        a: { type: "key", code: "KeyA" }
      }
    } as unknown as AnyConsoleLayout;

    const result = await resolveConsoleBindings({
      consoleId: "nes",
      profile: mockProfile,
      consoleLayout: mockConsoleLayout
    });

    expect(result).toEqual(mockConsoleLayout.bindings);
  });

  it("should fall back to default console bindings if consoleLayout.bindings is missing or null", async () => {
    const resultNull = await resolveConsoleBindings({
      consoleId: "nes",
      profile: mockProfile,
      consoleLayout: null
    });

    expect(resultNull).toBeDefined();
    // Default NES move bindings should be mapped as a dpad
    expect(resultNull.move).toBeDefined();
  });
});
