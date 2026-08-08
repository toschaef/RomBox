import type { IEmulatorTranslator, TranslateContext, EmulatorPatch } from "../translatorTypes";
import type { ControlsProfile, DigitalBinding } from "../../../shared/types/controls";
import type { Platform } from "../../../shared/types";
import { axisToDigitalToken } from "../../../shared/controls/gamepadTokens";
import { getDirFromDpad, getDirFromMove, getDirFromLook } from "../../utils/profileRead";
import { DuckStation, duckstationExprForGamepadToken } from "./schema";
import { KeycodeMapper } from "../../utils/keycodes/KeycodeMapper";
import { osHandler } from "../../platform";


function duckstationExprForDigital(b: DigitalBinding, platform: Platform = osHandler.getPlatform(), deviceIndex = 0): string | null {
  if (b.type === "key") {
    const key = KeycodeMapper.toKeycode("duckstation", b.code, platform);
    if (!key) return null;
    return `Keyboard/${key}`;
  }

  if (b.type === "gp_button") {
    return duckstationExprForGamepadToken(b.token, deviceIndex);
  }

  if (b.type === "gp_axis_digital") {
    const tok = axisToDigitalToken({
      stick: b.stick,
      axis: b.axis,
      sign: b.dir === "neg" ? -1 : 1,
    });
    return duckstationExprForGamepadToken(tok, deviceIndex);
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

export class DuckStationTranslator implements IEmulatorTranslator {
  id = "duckstation";

  translate(profile: ControlsProfile, ctx: TranslateContext): EmulatorPatch[] {

    const patches: EmulatorPatch[] = [];
    const iniPath = DuckStation.iniPath(ctx.configDir);
    const platform = ctx.platform ?? osHandler.getPlatform();

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
      const deviceIndex = i;
      
      const writeBinding = (label: string, b?: DigitalBinding) => {
        if (!b) return;
        const expr = duckstationExprForDigital(b, platform, deviceIndex);
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
    }

    return patches;
  }
}
