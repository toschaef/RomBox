import type { IEmulatorTranslator, TranslateContext, EmulatorPatch } from "./ITranslator";
import type { ControlsProfile, DigitalBinding } from "../../../shared/types/controls";
import { axisToDigitalToken } from "../../../shared/controls/gamepadTokens";
import { getDirFromDpad, getDirFromMove, getDirFromLook } from "../profileRead";
import { PCSX2, pcsx2KeyFromDomCode, pcsx2ExprForGamepadToken } from "../schema/pcsx2";


function pcsx2ExprForDigital(b: DigitalBinding, deviceIndex = 0): string | null {
  if (b.type === "key") {
    const key = pcsx2KeyFromDomCode(b.code);
    if (!key) return null;
    return `Keyboard/${key}`;
  }

  if (b.type === "gp_button") {
    return pcsx2ExprForGamepadToken(b.token, deviceIndex);
  }

  if (b.type === "gp_axis_digital") {
    const tok = axisToDigitalToken({
      stick: b.stick,
      axis: b.axis,
      sign: b.dir === "neg" ? -1 : 1,
    });
    return pcsx2ExprForGamepadToken(tok, deviceIndex);
  }

  return null;
}

function addIniPatch(
  patches: EmulatorPatch[],
  absPath: string,
  section: string,
  key: string,
  value: string
) {
  patches.push({ kind: "ini-set", absPath, section, key, value });
}

export class PCSX2Translator implements IEmulatorTranslator {
  id = "pcsx2";

  translate(profile: ControlsProfile, ctx: TranslateContext): EmulatorPatch[] {
    if (!ctx.configDir) throw new Error("PCSX2Translator requires ctx.configDir");

    const patches: EmulatorPatch[] = [];
    const iniPath = PCSX2.iniPath(ctx.configDir);
    const players = [
      { key: "player1" as const, prefix: "Pad1" },
      { key: "player2" as const, prefix: "Pad2" },
      { key: "player3" as const, prefix: "Pad3" },
      { key: "player4" as const, prefix: "Pad4" },
    ];

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!profile[p.key]) continue;
      const section = p.prefix;
      const deviceIndex = i; // Map Pad1 -> SDL-0, Pad2 -> SDL-1, etc.
      
      const writeBinding = (label: string, b?: DigitalBinding) => {
        if (!b) return;
        const expr = pcsx2ExprForDigital(b, deviceIndex);
        if (!expr) return;
        addIniPatch(patches, iniPath, section, label, expr);
      };

      writeBinding("Cross", profile[p.key]?.face?.primary);
      writeBinding("Circle", profile[p.key]?.face?.secondary);
      writeBinding("Square", profile[p.key]?.face?.tertiary);
      writeBinding("Triangle", profile[p.key]?.face?.quaternary);

      writeBinding("Start", profile[p.key]?.system?.start);
      writeBinding("Select", profile[p.key]?.system?.select);

      writeBinding("L1", profile[p.key]?.shoulders?.bumperL);
      writeBinding("R1", profile[p.key]?.shoulders?.bumperR);
      writeBinding("L2", profile[p.key]?.shoulders?.triggerL);
      writeBinding("R2", profile[p.key]?.shoulders?.triggerR);

      writeBinding("Up", getDirFromDpad(profile, p.key, "up"));
      writeBinding("Down", getDirFromDpad(profile, p.key, "down"));
      writeBinding("Left", getDirFromDpad(profile, p.key, "left"));
      writeBinding("Right", getDirFromDpad(profile, p.key, "right"));

      writeBinding("LUp", getDirFromMove(profile, p.key, "up"));
      writeBinding("LDown", getDirFromMove(profile, p.key, "down"));
      writeBinding("LLeft", getDirFromMove(profile, p.key, "left"));
      writeBinding("LRight", getDirFromMove(profile, p.key, "right"));

      writeBinding("RUp", getDirFromLook(profile, p.key, "up"));
      writeBinding("RDown", getDirFromLook(profile, p.key, "down"));
      writeBinding("RLeft", getDirFromLook(profile, p.key, "left"));
      writeBinding("RRight", getDirFromLook(profile, p.key, "right"));

      writeBinding("L3", profile[p.key]?.sticks?.l3);
      writeBinding("R3", profile[p.key]?.sticks?.r3);

      // The DualShock2's ANALOG button. Guide (PS/Home) is what PCSX2's own
      // automatic binding maps it to - the "Analog" entry carries
      // GenericInputBinding::System (PadDualshock2.cpp) - so this just matches
      // the emulator's default rather than leaving the button unbound.
      addIniPatch(patches, iniPath, section, "Analog", `SDL-${deviceIndex}/Guide`);
    }

    return patches;
  }
}

