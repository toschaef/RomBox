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
      const res = translator.translateFromPlayer(profile.player1, "darwin", 0);

      // Verify button index encodings: 0x2/0/<index>;;
      expect(res["A..South"]).toBe("0x2/0/0;;");   // GP_A = 0
      expect(res["B..East"]).toBe("0x2/0/1;;");    // GP_B = 1
      expect(res["X..West"]).toBe("0x2/0/2;;");    // GP_X = 2
      expect(res["Y..North"]).toBe("0x2/0/3;;");   // GP_Y = 3
      expect(res["L-Bumper"]).toBe("0x2/0/4;;");  // GP_L1 = 4
      expect(res["R-Bumper"]).toBe("0x2/0/5;;");  // GP_R1 = 5
      expect(res["L-Trigger"]).toBe("0x2/0/12;;"); // GP_L2 = 12
      expect(res["R-Trigger"]).toBe("0x2/0/13;;"); // GP_R2 = 13
      expect(res["Start"]).toBe("0x2/0/6;;");      // GP_START = 6
      expect(res["Select"]).toBe("0x2/0/7;;");     // GP_SELECT = 7
      expect(res["Pad.Up"]).toBe("0x2/0/8;;");     // GP_DPAD_UP = 8
      expect(res["Pad.Down"]).toBe("0x2/0/9;;");   // GP_DPAD_DOWN = 9
      expect(res["Pad.Left"]).toBe("0x2/0/10;;");  // GP_DPAD_LEFT = 10
      expect(res["Pad.Right"]).toBe("0x2/0/11;;"); // GP_DPAD_RIGHT = 11
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
      const resNormal = translator.translateFromPlayer(profileNormal.player1, "darwin", 0);

      // Normal left stick: up=GP_LS_UP (19), down=GP_LS_DOWN (18), left=GP_LS_LEFT (17), right=GP_LS_RIGHT (16)
      expect(resNormal["L-Up"]).toBe("0x2/0/19;;");
      expect(resNormal["L-Down"]).toBe("0x2/0/18;;");
      expect(resNormal["L-Left"]).toBe("0x2/0/17;;");
      expect(resNormal["L-Right"]).toBe("0x2/0/16;;");

      // Normal right stick (look): up=GP_RS_UP (23), down=GP_RS_DOWN (22), left=GP_RS_LEFT (21), right=GP_RS_RIGHT (20)
      expect(resNormal["R-Up"]).toBe("0x2/0/23;;");
      expect(resNormal["R-Down"]).toBe("0x2/0/22;;");
      expect(resNormal["R-Left"]).toBe("0x2/0/21;;");
      expect(resNormal["R-Right"]).toBe("0x2/0/20;;");

      // Inverted axes
      const profileInverted = createBaseProfile({
        player1: {
          ...createDefaultProfileShape().player1,
          move: { type: "stick", stick: "left", deadzone: 0.15, invertX: true, invertY: true },
          look: { type: "stick", stick: "right", deadzone: 0.15, invertX: true, invertY: true },
        },
      });

      const resInverted = translator.translateFromPlayer(profileInverted.player1, "darwin", 0);
      // Inverted left stick: up becomes GP_LS_DOWN (18), down becomes GP_LS_UP (19), left becomes GP_LS_RIGHT (16), right becomes GP_LS_LEFT (17)
      expect(resInverted["L-Up"]).toBe("0x2/0/18;;");
      expect(resInverted["L-Down"]).toBe("0x2/0/19;;");
      expect(resInverted["L-Left"]).toBe("0x2/0/16;;");
      expect(resInverted["L-Right"]).toBe("0x2/0/17;;");
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
      // Test device index = 2
      const resDev2 = translator.translateFromPlayer(profileN64.player1, "darwin", 2);

      // Z button mapped to GP_L2 (12) on device 2 -> 0x2/2/12;;
      expect(resDev2["L-Trigger"]).toBe("0x2/2/12;;");
      // C-up mapped to GP_RS_UP (23) on device 2 -> 0x2/2/23;;
      expect(resDev2["R-Up"]).toBe("0x2/2/23;;");
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

    it("should format multi-controller device indices across all SDL-capable translators", () => {
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

    it("should fallback to platform gamepad device (SDL on mac, XInput on win32) when no config or profile id exists", () => {
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
    it("should produce a clean json-merge patch targeting the correct console bucket and controller type", () => {
      const profile = createBaseProfile();
      const translator = new MesenTranslator();

      // Test SNES console
      const ctxSnes: TranslateContext = { configDir: tmpDir, consoleId: "snes", platform: "darwin" };
      const patchesSnes = translator.translate(profile, ctxSnes);

      expect(patchesSnes).toHaveLength(1);
      const pSnes = patchesSnes[0];
      expect(pSnes.kind).toBe("json-merge");
      if (pSnes.kind === "json-merge") {
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
      if (pGb.kind === "json-merge") {
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

    it("should successfully apply Mesen json-merge patch into a settings.json file", () => {
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
      if (patch.kind === "json-merge" && patch.absPath) {
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
