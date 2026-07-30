import { getConsoleLayoutItems } from "../../../../src/renderer/controls/consoleLayouts";

describe("consoleLayouts", () => {
  describe("getConsoleLayoutItems for Wii controller variants", () => {
    it("renders a distinct layout per Wii controller type", () => {
      const wiimote = getConsoleLayoutItems("wii", "wiimote");
      const sideways = getConsoleLayoutItems("wii", "wiimote_sideways");
      const nunchuk = getConsoleLayoutItems("wii", "wiimote_nunchuk");
      const classic = getConsoleLayoutItems("wii", "classic");
      const gamecube = getConsoleLayoutItems("wii", "gamecube");

      const serialized = [wiimote, sideways, nunchuk, classic, gamecube].map(items =>
        JSON.stringify(items.map(i => i.id))
      );
      // Every controller type the UI lets a user pick should show its own button set.
      expect(new Set(serialized).size).toBe(serialized.length);
    });

    it("renders the real Classic Controller layout (ZL/ZR/Home), not the plain GameCube layout", () => {
      const classic = getConsoleLayoutItems("wii", "classic");
      const ids = classic.map(i => i.id);

      // Regression: this used to fall through to CONSOLE_LAYOUTS["gc"], which has no
      // ZL/ZR/Home items and mislabels shoulders.triggerL/R as plain "Z".
      expect(ids).toContain("shoulders.triggerL");
      expect(ids).toContain("shoulders.triggerR");
      expect(ids).toContain("special.home");

      const zl = classic.find(i => i.id === "shoulders.triggerL");
      expect(zl && "label" in zl ? zl.label : null).toMatch(/ZL/);
    });

    it("renders the GameCube Controller layout for the real GC-pad-on-Wii option", () => {
      const gamecube = getConsoleLayoutItems("wii", "gamecube");
      const ids = gamecube.map(i => i.id);

      expect(ids).toContain("special.z");
      expect(ids).not.toContain("special.home");
    });

    it("excludes Wiimote-only inputs (IR Pointer, Tilt, Shake, Wiimote A/B/1/2, Nunchuk) from Classic Controller", () => {
      const classic = getConsoleLayoutItems("wii", "classic");
      const ids = classic.map(i => i.id);

      // Regression: Classic Controller previously reused the generic Wii
      // fallback layout, which also exposed these physical-Wiimote-only
      // controls. Binding "IR Pointer" to the same stick used for Classic
      // Right Stick made the emulated pointer jitter across the screen during
      // ordinary camera-stick gameplay, since a real Classic Controller has
      // no IR camera or accelerometer at all.
      expect(ids).not.toContain("special.ir");
      expect(ids).not.toContain("special.tilt");
      expect(ids).not.toContain("special.shake");
      expect(ids).not.toContain("special.wiimoteA");
      expect(ids).not.toContain("special.wiimoteB");
      expect(ids).not.toContain("special.nunchuckC");
      expect(ids).not.toContain("special.nunchuckZ");
    });
  });
});
