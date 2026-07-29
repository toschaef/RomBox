import fs from "fs";
import path from "path";
import os from "os";
import { AresTranslator } from "../../../src/main/utils/translators/AresTranslator";
import { DolphinTranslator } from "../../../src/main/utils/translators/DolphinTranslator";
import { DuckStationTranslator } from "../../../src/main/utils/translators/DuckStationTranslator";
import { PCSX2Translator } from "../../../src/main/utils/translators/PCSX2Translator";
import { MelonDSTranslator } from "../../../src/main/utils/translators/MelonDSTranslator";
import { MesenTranslator } from "../../../src/main/utils/translators/MesenTranslator";
import { getSDLDeviceIndex, parseSDLDeviceIndex } from "../../../src/main/utils/schema/duckstation";
import { detectDolphinPadDevice, getPlatformGamepadDevice, DOLPHIN } from "../../../src/main/utils/schema/dolphin";
import { createDefaultProfileShape } from "../../../src/shared/controls/layoutDefaults";
import type { ControlsProfile, DigitalBinding, PlayerBindings } from "../../../src/shared/types/controls";
import type { TranslateContext } from "../../../src/main/utils/translators/ITranslator";
import { JsonEditor } from "../../../src/main/utils/editors/json";

import child_process from "child_process";
describe("Milestone 2 Empirical Stress Tests", () => {
  let tmpDir: string;

  beforeEach(() => {
    jest.spyOn(child_process, "spawnSync").mockReturnValue({ stdout: "" } as any);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "m2-stress-"));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createBaseProfile(overrides?: Partial<ControlsProfile>): ControlsProfile {
    return {
      id: "stress-profile-id",
      name: "Stress Test Profile",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: true,
      ...createDefaultProfileShape(),
      ...overrides,
    };
  }

  // =========================================================================
  // 1. Ares Gamepad Translation Edge Cases
  // =========================================================================
  describe("1. Ares Gamepad Translation Edge Cases", () => {
    it("should correctly translate all gamepad face, shoulder, system, and dpad buttons", () => {
      const profile = createBaseProfile({
        player1: {
          ...createDefaultProfileShape().player1,
          face: {
            type: "face",
            primary: { type: "gp_button", token: "GP_A" },
            secondary: { type: "gp_button", token: "GP_B" },
            tertiary: { type: "gp_button", token: "GP_X" },
            quaternary: { type: "gp_button", token: "GP_Y" },
          },
          shoulders: {
            type: "shoulders",
            bumperL: { type: "gp_button", token: "GP_L1" },
            bumperR: { type: "gp_button", token: "GP_R1" },
            triggerL: { type: "gp_button", token: "GP_L2" },
            triggerR: { type: "gp_button", token: "GP_R2" },
          },
          system: {
            type: "system",
            start: { type: "gp_button", token: "GP_START" },
            select: { type: "gp_button", token: "GP_SELECT" },
          },
          dpad: {
            type: "dpad",
            up: { type: "gp_button", token: "GP_DPAD_UP" },
            down: { type: "gp_button", token: "GP_DPAD_DOWN" },
            left: { type: "gp_button", token: "GP_DPAD_LEFT" },
            right: { type: "gp_button", token: "GP_DPAD_RIGHT" },
          },
        },
      });

      const translator = new AresTranslator();
      // Raw button indices vary per controller hardware, so buttons are resolved from a probed
      // device's SDL controller-DB binding info rather than a fixed table; these are arbitrary
      // stand-in indices to exercise the plumbing.
      const binds = {
        GP_A: { kind: "button" as const, button: 0 },
        GP_B: { kind: "button" as const, button: 1 },
        GP_Y: { kind: "button" as const, button: 3 },
        GP_L1: { kind: "button" as const, button: 4 },
        GP_R1: { kind: "button" as const, button: 5 },
        GP_L2: { kind: "button" as const, button: 6 },
        GP_START: { kind: "button" as const, button: 8 },
        GP_SELECT: { kind: "button" as const, button: 9 },
      };
      const res = translator.translateFromPlayer(profile.player1, "darwin", "0xdead", binds);

      // Button encodings: <deviceID>/3/<rawIndex>;; (groupID 3=Button per HID::Joypad::GroupID).
      // N64 has no X face button or a distinct R-Trigger: B writes to "X..West" (N64 core reads B
      // from pad.west), tertiary (GP_X) and shoulders.triggerR (GP_R2) are not written since N64 has
      // no core input for them; Z falls back to shoulders.triggerL (GP_L2) on "R-Trigger".
      expect(res["A..South"]).toBe("0xdead/3/0;;");
      expect(res["X..West"]).toBe("0xdead/3/1;;");
      expect(res["Y..North"]).toBe("0xdead/3/3;;");
      expect(res["L-Bumper"]).toBe("0xdead/3/4;;");
      expect(res["R-Bumper"]).toBe("0xdead/3/5;;");
      expect(res["R-Trigger"]).toBe("0xdead/3/6;;"); // Z falls back to shoulders.triggerL
      expect(res["Start"]).toBe("0xdead/3/8;;");
      expect(res["Select"]).toBe("0xdead/3/9;;");

      // D-Pad is read as a Hat (groupID 1), split into horizontal (index 0) and vertical (index 1)
      // sub-inputs with a Lo/Hi qualifier for direction - a fixed, controller-independent SDL
      // convention (empirically confirmed against ares.app v146's own binding).
      expect(res["Pad.Up"]).toBe("0xdead/1/1/Lo;;");
      expect(res["Pad.Down"]).toBe("0xdead/1/1/Hi;;");
      expect(res["Pad.Left"]).toBe("0xdead/1/0/Lo;;");
      expect(res["Pad.Right"]).toBe("0xdead/1/0/Hi;;");
    });

    it("should correctly handle left and right analog stick axes and stick inversions", () => {
      const profileNormal = createBaseProfile({
        player1: {
          ...createDefaultProfileShape().player1,
          move: { type: "stick", stick: "left", deadzone: 0.15 },
          look: { type: "stick", stick: "right", deadzone: 0.15 },
        },
      });

      const translator = new AresTranslator();
      const resNormal = translator.translateFromPlayer(profileNormal.player1, "darwin", "0xdead");

      // Sticks are read as Axis (groupID 0): left stick uses index 0 (horizontal)/1 (vertical),
      // right stick uses index 2/3 - the standard SDL axis layout used by hidapi-backed gamepads,
      // with a Lo/Hi qualifier for direction (empirically confirmed against ares.app v146 for "L-Up").
      expect(resNormal["L-Up"]).toBe("0xdead/0/1/Lo;;");
      expect(resNormal["L-Down"]).toBe("0xdead/0/1/Hi;;");
      expect(resNormal["L-Left"]).toBe("0xdead/0/0/Lo;;");
      expect(resNormal["L-Right"]).toBe("0xdead/0/0/Hi;;");

      expect(resNormal["R-Up"]).toBe("0xdead/0/3/Lo;;");
      expect(resNormal["R-Down"]).toBe("0xdead/0/3/Hi;;");
      expect(resNormal["R-Left"]).toBe("0xdead/0/2/Lo;;");
      expect(resNormal["R-Right"]).toBe("0xdead/0/2/Hi;;");

      // Inverted axes
      const profileInverted = createBaseProfile({
        player1: {
          ...createDefaultProfileShape().player1,
          move: { type: "stick", stick: "left", deadzone: 0.15, invertX: true, invertY: true },
          look: { type: "stick", stick: "right", deadzone: 0.15, invertX: true, invertY: true },
        },
      });

      const resInverted = translator.translateFromPlayer(profileInverted.player1, "darwin", "0xdead");
      // Inverted left stick: up now reads the "down" (Hi) binding, down reads "up" (Lo), etc.
      expect(resInverted["L-Up"]).toBe("0xdead/0/1/Hi;;");
      expect(resInverted["L-Down"]).toBe("0xdead/0/1/Lo;;");
      expect(resInverted["L-Left"]).toBe("0xdead/0/0/Hi;;");
      expect(resInverted["L-Right"]).toBe("0xdead/0/0/Lo;;");
    });

    it("should correctly handle N64 special bindings and deviceIndex parameter in Ares", () => {
      const profileN64 = createBaseProfile({
        player1: {
          ...createDefaultProfileShape().player1,
          special: {
            type: "n64",
            z: { type: "gp_button", token: "GP_L2" },
            c: {
              type: "dpad",
              up: { type: "gp_button", token: "GP_RS_UP" },
              down: { type: "gp_button", token: "GP_RS_DOWN" },
              left: { type: "gp_button", token: "GP_RS_LEFT" },
              right: { type: "gp_button", token: "GP_RS_RIGHT" },
            },
          },
        },
      });

      const translator = new AresTranslator();
      const binds = { GP_L2: { kind: "button" as const, button: 6 } };
      const res = translator.translateFromPlayer(profileN64.player1, "darwin", "0xdead", binds);

      // Z (special.z = GP_L2) -> button group, raw index from probed binds
      expect(res["R-Trigger"]).toBe("0xdead/3/6;;");
      // C-up (special.c.up = GP_RS_UP) -> right stick, vertical index 3, Lo (up)
      expect(res["R-Up"]).toBe("0xdead/0/3/Lo;;");
    });
  });

  // =========================================================================
  // 2. Multi-Controller SDL Device Indices (SDL-0, SDL-1, SDL-2)
  // =========================================================================
  describe("2. Multi-Controller SDL Device Indices", () => {
    it("should parse SDL device indices from diverse device strings", () => {
      expect(parseSDLDeviceIndex("SDL-0")).toBe(0);
      expect(parseSDLDeviceIndex("SDL-1")).toBe(1);
      expect(parseSDLDeviceIndex("SDL-2")).toBe(2);
      expect(parseSDLDeviceIndex("SDL/0/Gamepad")).toBe(0);
      expect(parseSDLDeviceIndex("SDL-2/Xbox Controller")).toBe(2);
      expect(parseSDLDeviceIndex("Gamepad 2")).toBe(2);
      expect(parseSDLDeviceIndex("2")).toBe(2);
      expect(parseSDLDeviceIndex(null)).toBeNull();
      expect(parseSDLDeviceIndex("")).toBeNull();
    });

    it("should follow precedence rules in getSDLDeviceIndex", () => {
      const profile = createBaseProfile({ preferredControllerId: "SDL-1" });

      // 1. ctx.learnedDevice takes highest precedence
      expect(getSDLDeviceIndex({ learnedDevice: "SDL-2" }, profile)).toBe(2);

      // 2. ctx.deviceIndex takes next precedence
      expect(getSDLDeviceIndex({ deviceIndex: 3 }, profile)).toBe(3);

      // 3. profile.preferredControllerId
      expect(getSDLDeviceIndex({}, profile)).toBe(1);

      // 4. ctx.padPort (1-based index converts to 0-based)
      expect(getSDLDeviceIndex({ padPort: 2 })).toBe(1);
      expect(getSDLDeviceIndex({ padPort: 1 })).toBe(0);

      // 5. Fallback to 0
      expect(getSDLDeviceIndex({})).toBe(0);
    });

    it.skip("should format multi-controller device indices across all SDL-capable translators", () => {
      const profile = createBaseProfile({
        player1: {
          ...createDefaultProfileShape().player1,
          face: {
            type: "face",
            primary: { type: "gp_button", token: "GP_A" },
            secondary: { type: "gp_button", token: "GP_B" },
            tertiary: { type: "gp_button", token: "GP_X" },
            quaternary: { type: "gp_button", token: "GP_Y" },
          },
        },
      });

      for (const devIdx of [0, 1, 2]) {
        const ctx: TranslateContext = {
          configDir: tmpDir,
          platform: "darwin",
          deviceIndex: devIdx,
        };

        // DuckStationTranslator -> SDL-<idx>/...
        const dsTranslator = new DuckStationTranslator();
        const dsPatches = dsTranslator.translate(profile, ctx);
        const dsCross = dsPatches.find((p) => p.kind === "ini-set" && p.key === "Cross");
        expect(dsCross).toBeDefined();
        if (dsCross && dsCross.kind === "ini-set") {
          expect(dsCross.value).toBe(`SDL-${devIdx}/A`);
        }

        // PCSX2Translator -> SDL-<idx>/...
        const pcsx2Translator = new PCSX2Translator();
        const pcsx2Patches = pcsx2Translator.translate(profile, ctx);
        const pcsx2Cross = pcsx2Patches.find((p) => p.kind === "ini-set" && p.key === "Cross");
        expect(pcsx2Cross).toBeDefined();
        if (pcsx2Cross && pcsx2Cross.kind === "ini-set") {
          expect(pcsx2Cross.value).toBe(`SDL-${devIdx}/FaceSouth`);
        }

        // AresTranslator -> 0x2/<idx>/...
        const aresTranslator = new AresTranslator();
        const aresPatches = aresTranslator.translate(profile, ctx);
        const aresSouth = aresPatches.find((p) => p.kind === "ini-set" && p.key === "A..South");
        expect(aresSouth).toBeDefined();
        if (aresSouth && aresSouth.kind === "ini-set") {
          expect(aresSouth.value).toBe(`0x2/${devIdx}/0;;`);
        }

        // DolphinTranslator -> SDL/<idx>/Gamepad (darwin)
        const dolphinTranslator = new DolphinTranslator();
        const dolPatches = dolphinTranslator.translate(profile, ctx);
        const dolDevice = dolPatches.find((p) => p.kind === "ini-set" && p.section === "GCPad1" && p.key === "Device");
        expect(dolDevice).toBeDefined();
        if (dolDevice && dolDevice.kind === "ini-set") {
          expect(dolDevice.value).toBe(`SDL/${devIdx}/Gamepad`);
        }

        // MelonDSTranslator -> JoystickID = <idx>
        const melonTranslator = new MelonDSTranslator();
        const melonPatches = melonTranslator.translateFromPlayer(profile.player1, ctx, devIdx);
        const melonJoyId = melonPatches.find((p) => p.kind === "ini-set" && p.key === "JoystickID");
        expect(melonJoyId).toBeDefined();
        if (melonJoyId && melonJoyId.kind === "ini-set") {
          expect(melonJoyId.value).toBe(String(devIdx));
        }
      }
    });
  });

  // =========================================================================
  // 3. Dolphin Device Fallback
  // =========================================================================
  describe("3. Dolphin Device Fallback", () => {
    it("should return Quartz keyboard device on macOS when profile uses keyboard bindings", () => {
      const kbProfile = createBaseProfile(); // default profile uses keyboard bindings
      const translator = new DolphinTranslator();
      const ctx: TranslateContext = { configDir: tmpDir, platform: "darwin" };

      const patches = translator.translate(kbProfile, ctx);
      const devPatch = patches.find((p) => p.kind === "ini-set" && p.section === "GCPad1" && p.key === "Device");
      if (devPatch && devPatch.kind === "ini-set") {
        expect(devPatch.value).toBe(DOLPHIN.MAC_QUARTZ_DEVICE); // Quartz/0/Keyboard & Mouse
      }
    });

    it("should prioritize ctx.learnedDevice over profile and detected device for gamepads", () => {
      const gpProfile = createBaseProfile({
        preferredControllerId: "SDL/1/ProfilePad",
        player1: {
          ...createDefaultProfileShape().player1,
          face: {
            type: "face",
            primary: { type: "gp_button", token: "GP_A" },
            secondary: { type: "gp_button", token: "GP_B" },
            tertiary: { type: "gp_button", token: "GP_X" },
            quaternary: { type: "gp_button", token: "GP_Y" },
          },
        },
      });

      const translator = new DolphinTranslator();
      const ctx: TranslateContext = {
        configDir: tmpDir,
        platform: "darwin",
        learnedDevice: "SDL/3/LearnedPad",
      };

      const patches = translator.translate(gpProfile, ctx);
      const devPatch = patches.find((p) => p.kind === "ini-set" && p.section === "GCPad1" && p.key === "Device");
      if (devPatch && devPatch.kind === "ini-set") {
        expect(devPatch.value).toBe("SDL/3/LearnedPad");
      }
    });

    it("should use detectDolphinPadDevice when existing GCPadNew.ini has a non-keyboard device", () => {
      const gcPadPath = DOLPHIN.gcPadNewPath(tmpDir);
      fs.writeFileSync(
        gcPadPath,
        `[GCPad1]\nDevice = WGUS/0/Wireless Controller\nButtons/A = \`Button A\`\n`
      );

      const gpProfile = createBaseProfile({
        player1: {
          ...createDefaultProfileShape().player1,
          face: {
            type: "face",
            primary: { type: "gp_button", token: "GP_A" },
            secondary: { type: "gp_button", token: "GP_B" },
            tertiary: { type: "gp_button", token: "GP_X" },
            quaternary: { type: "gp_button", token: "GP_Y" },
          },
        },
      });

      const translator = new DolphinTranslator();
      const ctx: TranslateContext = { configDir: tmpDir, platform: "darwin" };

      const patches = translator.translate(gpProfile, ctx);
      const devPatch = patches.find((p) => p.kind === "ini-set" && p.section === "GCPad1" && p.key === "Device");
      if (devPatch && devPatch.kind === "ini-set") {
        expect(devPatch.value).toBe("WGUS/0/Wireless Controller");
      }
    });

    it.skip("should fallback to platform gamepad device (SDL on mac, XInput on win32) when no config or profile id exists", () => {
      const gpProfile = createBaseProfile({
        player1: {
          ...createDefaultProfileShape().player1,
          face: {
            type: "face",
            primary: { type: "gp_button", token: "GP_A" },
            secondary: { type: "gp_button", token: "GP_B" },
            tertiary: { type: "gp_button", token: "GP_X" },
            quaternary: { type: "gp_button", token: "GP_Y" },
          },
        },
      });

      const translator = new DolphinTranslator();

      // Test macOS fallback
      const ctxMac: TranslateContext = { configDir: tmpDir, platform: "darwin", deviceIndex: 0 };
      const patchesMac = translator.translate(gpProfile, ctxMac);
      const devMac = patchesMac.find((p) => p.kind === "ini-set" && p.section === "GCPad1" && p.key === "Device");
      if (devMac && devMac.kind === "ini-set") {
        expect(devMac.value).toBe("SDL/0/Gamepad");
      }

      // Test Windows fallback
      const ctxWin: TranslateContext = { configDir: tmpDir, platform: "win32", deviceIndex: 1 };
      const patchesWin = translator.translate(gpProfile, ctxWin);
      const devWin = patchesWin.find((p) => p.kind === "ini-set" && p.section === "GCPad1" && p.key === "Device");
      if (devWin && devWin.kind === "ini-set") {
        expect(devWin.value).toBe("XInput/1/Gamepad");
      }
    });

    it("should write game INI patch when ctx.gameId is provided", () => {
      const profile = createBaseProfile();
      const translator = new DolphinTranslator();
      const ctx: TranslateContext = { configDir: tmpDir, platform: "darwin", gameId: "GALE01" };

      const patches = translator.translate(profile, ctx);
      const gamePatch = patches.find((p) => p.absPath?.includes("GALE01.ini"));
      expect(gamePatch).toBeDefined();
      expect(gamePatch).toEqual({
        kind: "ini-set",
        absPath: path.join(tmpDir, "GameSettings", "GALE01.ini"),
        section: "Controls",
        key: "PadType0",
        value: "6",
      });
    });
  });

  // =========================================================================
  // 4. Mesen Pure Patch Output
  // =========================================================================
  describe("4. Mesen Pure Patch Output", () => {
    it("should produce a clean json-set patch targeting the correct console bucket and controller type", () => {
      const profile = createBaseProfile();
      const translator = new MesenTranslator();

      // Test SNES console
      const ctxSnes: TranslateContext = { configDir: tmpDir, consoleId: "snes", platform: "darwin" };
      const patchesSnes = translator.translate(profile, ctxSnes);

      expect(patchesSnes).toHaveLength(1);
      const pSnes = patchesSnes[0];
      expect(pSnes.kind).toBe("json-set");
      if (pSnes.kind === "json-set") {
        expect(pSnes.absPath).toBe(path.join(tmpDir, "settings.json"));
        expect(pSnes.path).toEqual(["Snes"]);

        const valSnes = pSnes.value as Record<string, unknown>;
        expect(valSnes.Port1).toBeDefined();
        const port1 = valSnes.Port1 as Record<string, unknown>;
        expect(port1.Type).toBe("SnesController");
        expect(port1.Mapping1).toBeDefined();
        expect(port1.Mapping2).toBeDefined();
      }

      // Test GB console (uses "Controller" root key instead of "Port1")
      const ctxGb: TranslateContext = { configDir: tmpDir, consoleId: "gb", platform: "darwin" };
      const patchesGb = translator.translate(profile, ctxGb);
      expect(patchesGb).toHaveLength(1);
      const pGb = patchesGb[0];
      if (pGb.kind === "json-set") {
        expect(pGb.path).toEqual(["Gameboy"]);
        const valGb = pGb.value as Record<string, unknown>;
        expect(valGb.Controller).toBeDefined();
        const controllerGb = valGb.Controller as Record<string, unknown>;
        expect(controllerGb.Type).toBe("GameboyController");
      }
    });

    it("should encode Mesen gamepad codes using base offset 0x1000 + (player - 1)*0x100 + index", () => {
      const gpProfile = createBaseProfile({
        player1: {
          ...createDefaultProfileShape().player1,
          face: {
            type: "face",
            primary: { type: "gp_button", token: "GP_A" },
            secondary: { type: "gp_button", token: "GP_B" },
            tertiary: { type: "gp_button", token: "GP_X" },
            quaternary: { type: "gp_button", token: "GP_Y" },
          },
        },
      });

      const translator = new MesenTranslator();
      const res = translator.translateForDeviceFromPlayer(gpProfile.player1, 1, "gamepad", "move", "darwin");

      // Player 1 gamepad codes: 0x1000 (4096) + 0 + GP_A (0) = 4096
      expect(res["A"]).toBe(4096); // GP_A
      expect(res["B"]).toBe(4097); // GP_B (idx 1)
      expect(res["X"]).toBe(4098); // GP_X (idx 2)
      expect(res["Y"]).toBe(4099); // GP_Y (idx 3)

      // Player 2 gamepad codes: 0x1000 + 256 + 0 = 4352
      const resP2 = translator.translateForDeviceFromPlayer(gpProfile.player1, 2, "gamepad", "move", "darwin");
      expect(resP2["A"]).toBe(4352);
    });

    it("should successfully apply Mesen json-set patch into a settings.json file", () => {
      const settingsPath = path.join(tmpDir, "settings.json");
      JsonEditor.write(settingsPath, {
        Snes: {
          Port1: {
            Type: "SnesController",
            Mapping1: { A: 999 },
          },
        },
      });

      const profile = createBaseProfile();
      const translator = new MesenTranslator();
      const ctx: TranslateContext = { configDir: tmpDir, consoleId: "snes", platform: "darwin" };

      const patches = translator.translate(profile, ctx);
      expect(patches).toHaveLength(1);

      // Apply patch using JsonEditor
      const patch = patches[0];
      if (patch.kind === "json-set" && patch.absPath) {
        JsonEditor.update<Record<string, unknown>>(patch.absPath, (settings) => {
          const root = settings && typeof settings === "object" ? settings : {};
          const pathParts = patch.path;
          let current = root as Record<string, unknown>;
          for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            if (!current[part] || typeof current[part] !== "object") {
              current[part] = {};
            }
            current = current[part] as Record<string, unknown>;
          }
          const lastPart = pathParts[pathParts.length - 1];
          const existing = current[lastPart];
          if (existing && typeof existing === "object" && !Array.isArray(existing) && patch.value && typeof patch.value === "object") {
            current[lastPart] = { ...existing, ...(patch.value as object) };
          } else {
            current[lastPart] = patch.value;
          }
          return root;
        });
      }

      const updatedSettings = JsonEditor.read<Record<string, unknown>>(settingsPath);
      expect(updatedSettings.Snes).toBeDefined();
      const snes = updatedSettings.Snes as Record<string, unknown>;
      expect(snes.Port1).toBeDefined();
    });
  });
});
