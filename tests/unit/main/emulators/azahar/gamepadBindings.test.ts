// the gamepad half of the azahar translator: every binding is encoded from
// whatever the sdl probe learned about the attached controller.
import { AzaharTranslator } from "../../../../../src/main/emulators/azahar/translator";
import { createDefaultProfileShape } from "../../../../../src/shared/controls/layoutDefaults";
import type { AzaharLearnedSDL } from "../../../../../src/main/emulators/azahar/sdlProbe";
import type {
  ControlsProfile,
  PlayerBindings,
} from "../../../../../src/shared/types/controls";
import type { TranslateContext } from "../../../../../src/main/emulators/translatorTypes";

const ctx: TranslateContext = {
  platform: "darwin",
  configDir: "/mock/config",
  consoleId: "3ds",
  player: 1,
  padPort: 1,
};

const learned: AzaharLearnedSDL = {
  ok: true,
  guid: "030000004c050000cc09000000000000",
  name: "Wireless Controller",
  port: 0,
  binds: {
    GP_A: { kind: "button", button: 1 },
    GP_B: { kind: "button", button: 0 },
    GP_DPAD_UP: { kind: "hat", hat: 0, direction: "up" },
    GP_LS_UP: { kind: "axis", axis: 1, direction: "-", threshold: 0.5 },
    GP_LS_DOWN: { kind: "axis", axis: 1, direction: "+", threshold: 0.5 },
    GP_LS_LEFT: { kind: "axis", axis: 0, direction: "-", threshold: 0.5 },
    GP_LS_RIGHT: { kind: "axis", axis: 0, direction: "+", threshold: 0.5 },
  },
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
  };
}

function valueFor(patches: ReturnType<AzaharTranslator["translate"]>, key: string) {
  const patch = patches.find((p) => p.kind === "ini-set" && p.key.endsWith(key));
  return patch && patch.kind === "ini-set" ? patch.value : undefined;
}

describe("AzaharTranslator with a learned gamepad", () => {
  it("encodes a face button as an sdl button binding", () => {
    const profile = profileWith({
      face: {
        ...createDefaultProfileShape().player1.face,
        primary: { type: "gp_button", token: "GP_A" },
      },
    } as Partial<PlayerBindings>);

    const patches = new AzaharTranslator(learned).translate(profile, ctx);
    const value = valueFor(patches, "button_a");

    expect(value).toContain("button:1");
    expect(value).toContain("engine:sdl");
    expect(value).toContain(`guid:${learned.guid}`);
    expect(value).toContain("port:0");
  });

  it("encodes a d-pad hat binding", () => {
    const base = createDefaultProfileShape().player1;
    const profile = profileWith({
      dpad: { ...base.dpad, up: { type: "gp_button", token: "GP_DPAD_UP" } },
    } as Partial<PlayerBindings>);

    const patches = new AzaharTranslator(learned).translate(profile, ctx);
    const value = valueFor(patches, "button_up");

    expect(value).toContain("direction:up");
    expect(value).toContain("hat:0");
  });

  it("encodes an axis binding with its threshold", () => {
    const base = createDefaultProfileShape().player1;
    const profile = profileWith({
      face: {
        ...base.face,
        primary: {
          type: "gp_axis_digital",
          stick: "left",
          axis: "y",
          dir: "neg",
          threshold: 0.5,
        },
      },
    } as Partial<PlayerBindings>);

    const patches = new AzaharTranslator(learned).translate(profile, ctx);
    const value = valueFor(patches, "button_a");

    expect(value).toContain("axis:1");
    expect(value).toContain("direction:-");
    expect(value).toContain("threshold:0.5");
  });

  it("uses the probe's stick blob when move is bound to a physical stick", () => {
    const withStick: AzaharLearnedSDL = {
      ...learned,
      sticks: { circle_pad: "PRE_BUILT_BLOB" },
    };
    const profile = profileWith({
      move: { type: "stick", stick: "left", deadzone: 0.2 },
    } as Partial<PlayerBindings>);

    const patches = new AzaharTranslator(withStick).translate(profile, ctx);
    expect(valueFor(patches, "circle_pad")).toContain("PRE_BUILT_BLOB");
  });

  it("synthesizes the circle pad from direction keys when move is a dpad", () => {
    // the default profile binds movement to WASD rather than a stick
    const patches = new AzaharTranslator(learned).translate(
      profileWith({}) as ControlsProfile,
      ctx
    );
    expect(valueFor(patches, "circle_pad")).toContain("engine:analog_from_button");
  });

  it("falls back to keyboard encoding when no gamepad was learned", () => {
    const base = createDefaultProfileShape().player1;
    const profile = profileWith({
      face: { ...base.face, primary: { type: "key", code: "KeyU" } },
    } as Partial<PlayerBindings>);

    const patches = new AzaharTranslator(null).translate(profile, ctx);
    const value = valueFor(patches, "button_a");

    expect(value).toContain("engine:keyboard");
    expect(value).not.toContain("sdl");
  });

  it("omits a gamepad binding the probe never learned", () => {
    const base = createDefaultProfileShape().player1;
    const sparse: AzaharLearnedSDL = { ...learned, binds: {} };
    const profile = profileWith({
      face: { ...base.face, primary: { type: "gp_button", token: "GP_A" } },
    } as Partial<PlayerBindings>);

    const patches = new AzaharTranslator(sparse).translate(profile, ctx);
    // nothing usable, so no button_a patch is written
    expect(valueFor(patches, "button_a")).toBeUndefined();
  });

  it("still names the profile regardless of bindings", () => {
    const patches = new AzaharTranslator(learned).translate(
      profileWith({}) as ControlsProfile,
      ctx
    );
    expect(patches.some((p) => p.kind === "ini-set" && p.key.includes("name"))).toBe(true);
  });
});
