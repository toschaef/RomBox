import type { IEmulatorTranslator, TranslateContext, EmulatorPatch } from "./ITranslator";
import type { ControlsProfile, DigitalBinding } from "../../../shared/types/controls";
import { axisToDigitalToken } from "../../../shared/controls/gamepadTokens";
import { getDirFromDpad, getDirFromMove, getDirFromLook } from "../profileRead";
import { PCSX2, pcsx2KeyFromDomCode, pcsx2ExprForGamepadToken } from "../schema/pcsx2";


function pcsx2ExprForDigital(b: DigitalBinding): string | null {
  if (b.type === "key") {
    const key = pcsx2KeyFromDomCode(b.code);
    if (!key) return null;
    return `Keyboard/${key}`;
  }

  if (b.type === "gp_button") {
    return pcsx2ExprForGamepadToken(b.token);
  }

  if (b.type === "gp_axis_digital") {
    const tok = axisToDigitalToken({
      stick: b.stick,
      axis: b.axis,
      sign: b.dir === "neg" ? -1 : 1,
    });
    return pcsx2ExprForGamepadToken(tok);
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
    const section = "Pad1";

    const writeBinding = (label: string, b?: DigitalBinding) => {
      if (!b) return;
      const expr = pcsx2ExprForDigital(b);
      if (!expr) return;
      addIniPatch(patches, iniPath, section, label, expr);
    };

    writeBinding("Cross", profile.player1.face?.primary);
    writeBinding("Circle", profile.player1.face?.secondary);
    writeBinding("Square", profile.player1.face?.tertiary);
    writeBinding("Triangle", profile.player1.face?.quaternary);

    writeBinding("Start", profile.player1.system?.start);
    writeBinding("Select", profile.player1.system?.select);

    writeBinding("L1", profile.player1.shoulders?.bumperL);
    writeBinding("R1", profile.player1.shoulders?.bumperR);
    writeBinding("L2", profile.player1.shoulders?.triggerL);
    writeBinding("R2", profile.player1.shoulders?.triggerR);

    writeBinding("Up", getDirFromDpad(profile, "up"));
    writeBinding("Down", getDirFromDpad(profile, "down"));
    writeBinding("Left", getDirFromDpad(profile, "left"));
    writeBinding("Right", getDirFromDpad(profile, "right"));

    writeBinding("LUp", getDirFromMove(profile, "up"));
    writeBinding("LDown", getDirFromMove(profile, "down"));
    writeBinding("LLeft", getDirFromMove(profile, "left"));
    writeBinding("LRight", getDirFromMove(profile, "right"));

    writeBinding("RUp", getDirFromLook(profile, "up"));
    writeBinding("RDown", getDirFromLook(profile, "down"));
    writeBinding("RLeft", getDirFromLook(profile, "left"));
    writeBinding("RRight", getDirFromLook(profile, "right"));

    if (profile.player1.special && (profile.player1.special as any).l3) {
      writeBinding("L3", (profile.player1.special as any).l3);
    }
    if (profile.player1.special && (profile.player1.special as any).r3) {
      writeBinding("R3", (profile.player1.special as any).r3);
    }

    return patches;
  }
}

