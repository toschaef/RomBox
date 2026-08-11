// the gamepad half of the melonds translator: stick directions become packed
// axis codes, and the y axis is deliberately flipped on the way out.
import { MelonDSTranslator } from "../../../../../src/main/emulators/melonds/translator";
import { melondsJoyCodeForToken } from "../../../../../src/main/emulators/melonds/schema";
import { createDefaultProfileShape } from "../../../../../src/shared/controls/layoutDefaults";
import type {
  ControlsProfile,
  PlayerBindings,
} from "../../../../../src/shared/types/controls";
import type { TranslateContext } from "../../../../../src/main/emulators/translatorTypes";

const ctx: TranslateContext = {
  platform: "darwin",
  configDir: "/mock/config",
  consoleId: "ds",
  player: 1,
};

function profileWith(player1: Partial<PlayerBindings>): ControlsProfile {
  const base = createDefaultProfileShape();
  return {
    id: "p1",
    name: "Test",
    createdAt: 0,
    updatedAt: 0,
    isDefault: true,
    ...base,
    player1: { ...base.player1, ...player1 } as PlayerBindings,
    melonJoystickId: 0,
  } as ControlsProfile;
}

function joyValue(
  patches: ReturnType<MelonDSTranslator["translate"]>,
  key: string
): number | undefined {
  const patch = patches.find(
    (p) => p.kind === "ini-set" && p.key === key && p.section?.includes("Joystick")
  );
  return patch && patch.kind === "ini-set" ? Number(patch.value) : undefined;
}

const translate = (p: ControlsProfile) => new MelonDSTranslator().translate(p, ctx);

describe("MelonDSTranslator gamepad bindings", () => {
  it("writes the joystick id from the profile", () => {
    const patches = new MelonDSTranslator().translate(
      { ...profileWith({}), melonJoystickId: 3 } as ControlsProfile,
      ctx
    );
    const patch = patches.find((p) => p.kind === "ini-set" && p.key === "JoystickID");
    expect(patch && patch.kind === "ini-set" ? patch.value : undefined).toBe("3");
  });

  it("encodes a face button as its joy code", () => {
    const base = createDefaultProfileShape().player1;
    const patches = translate(
      profileWith({
        face: { ...base.face, primary: { type: "gp_button", token: "GP_A" } },
      } as Partial<PlayerBindings>)
    );

    expect(joyValue(patches, "A")).toBe(melondsJoyCodeForToken("GP_A"));
  });

  it("maps a left-stick binding to the packed axis code", () => {
    const base = createDefaultProfileShape().player1;
    const patches = translate(
      profileWith({
        dpad: {
          ...base.dpad,
          left: {
            type: "gp_axis_digital",
            stick: "left",
            axis: "x",
            dir: "neg",
            threshold: 0.65,
          },
        },
      } as Partial<PlayerBindings>)
    );

    expect(joyValue(patches, "Left")).toBe(melondsJoyCodeForToken("GP_LS_LEFT"));
  });

  it("flips the vertical axis, which melonds reads inverted", () => {
    const base = createDefaultProfileShape().player1;
    const patches = translate(
      profileWith({
        dpad: {
          ...base.dpad,
          up: {
            type: "gp_axis_digital",
            stick: "left",
            axis: "y",
            dir: "neg",
            threshold: 0.65,
          },
        },
      } as Partial<PlayerBindings>)
    );

    // an "up" binding is emitted as the DOWN code
    expect(joyValue(patches, "Up")).toBe(melondsJoyCodeForToken("GP_LS_DOWN"));
  });

  it("derives dpad directions from an analog stick move binding", () => {
    const patches = translate(
      profileWith({
        move: { type: "stick", stick: "left", deadzone: 0.2 },
      } as Partial<PlayerBindings>)
    );

    expect(joyValue(patches, "Left")).toBe(melondsJoyCodeForToken("GP_LS_LEFT"));
    expect(joyValue(patches, "Right")).toBe(melondsJoyCodeForToken("GP_LS_RIGHT"));
  });

  it("honours an inverted stick", () => {
    const patches = translate(
      profileWith({
        move: { type: "stick", stick: "left", deadzone: 0.2, invertX: true },
      } as Partial<PlayerBindings>)
    );

    // inverting x swaps which code each direction gets
    expect(joyValue(patches, "Left")).toBe(melondsJoyCodeForToken("GP_LS_RIGHT"));
    expect(joyValue(patches, "Right")).toBe(melondsJoyCodeForToken("GP_LS_LEFT"));
  });

  it("uses the right stick when the binding says so", () => {
    const base = createDefaultProfileShape().player1;
    const patches = translate(
      profileWith({
        dpad: {
          ...base.dpad,
          right: {
            type: "gp_axis_digital",
            stick: "right",
            axis: "x",
            dir: "pos",
            threshold: 0.65,
          },
        },
      } as Partial<PlayerBindings>)
    );

    expect(joyValue(patches, "Right")).toBe(melondsJoyCodeForToken("GP_RS_RIGHT"));
  });

  it("writes -1 for a direction with no gamepad binding", () => {
    // the default profile is keyboard-only, so joystick entries are unset
    const patches = translate(profileWith({}));
    expect(joyValue(patches, "A")).toBe(-1);
  });

  it("still emits keyboard bindings alongside the joystick table", () => {
    const patches = translate(profileWith({}));
    const kb = patches.find(
      (p) => p.kind === "ini-set" && p.section?.includes("Keyboard") && p.key === "A"
    );
    expect(kb).toBeDefined();
  });

  describe("with a probed physical device", () => {
    // the static table is a guess; a probed bind for the same token must win,
    // since it reflects whatever raw index the attached controller actually
    // reports on this platform/backend.
    it("prefers a probed button index over the static table", () => {
      const base = createDefaultProfileShape().player1;
      const patches = new MelonDSTranslator().translate(
        profileWith({
          face: { ...base.face, primary: { type: "gp_button", token: "GP_A" } },
        } as Partial<PlayerBindings>),
        { ...ctx, learnedBinds: { GP_A: { kind: "button", button: 42 } } }
      );

      expect(joyValue(patches, "A")).toBe(42);
    });

    it("packs a probed axis bind the same way as the static axis encoding", () => {
      const base = createDefaultProfileShape().player1;
      const patches = new MelonDSTranslator().translate(
        profileWith({
          dpad: {
            ...base.dpad,
            left: { type: "gp_axis_digital", stick: "left", axis: "x", dir: "neg", threshold: 0.65 },
          },
        } as Partial<PlayerBindings>),
        { ...ctx, learnedBinds: { GP_LS_LEFT: { kind: "axis", axis: 5, direction: "-", threshold: 0.5 } } }
      );

      // axisIndex << 24 | negative-sign byte << 16
      expect(joyValue(patches, "Left")).toBe((5 << 24) | (0x11 << 16));
    });

    it("packs a probed hat bind using melonDS's hat/direction bit layout", () => {
      const base = createDefaultProfileShape().player1;
      const patches = new MelonDSTranslator().translate(
        profileWith({
          dpad: {
            ...base.dpad,
            up: { type: "gp_button", token: "GP_DPAD_UP" },
          },
        } as Partial<PlayerBindings>),
        { ...ctx, learnedBinds: { GP_DPAD_UP: { kind: "hat", hat: 0, direction: "up" } } }
      );

      // hasbtn flag (0x100) | hat index << 4 | up direction bit (0x1)
      expect(joyValue(patches, "Up")).toBe(0x100 | (0 << 4) | 0x1);
    });

    it("falls back to the static table for a token the probe didn't report", () => {
      const base = createDefaultProfileShape().player1;
      const patches = new MelonDSTranslator().translate(
        profileWith({
          face: { ...base.face, primary: { type: "gp_button", token: "GP_A" } },
        } as Partial<PlayerBindings>),
        { ...ctx, learnedBinds: { GP_B: { kind: "button", button: 99 } } }
      );

      expect(joyValue(patches, "A")).toBe(melondsJoyCodeForToken("GP_A"));
    });
  });
});
