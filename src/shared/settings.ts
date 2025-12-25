export type SettingKey =
  | "ui.fullscreen"
  | "controls.activeProfileId"
  | "launch.closeOnExit";

export type SettingsShape = {
  "ui.fullscreen": boolean;
  "controls.activeProfileId": string;
  "launch.closeOnExit": boolean;
};

export const SETTINGS_DEFAULTS: SettingsShape = {
  "ui.fullscreen": false,
  "controls.activeProfileId": "",
  "launch.closeOnExit": false,
};
