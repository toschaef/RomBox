export type SettingKey =
  | "ui.fullscreen"
  | "controls.activeProfileId"
  | "launch.closeOnExit"
  | "launch.fullscreen"
  | "launch.resolution"
  | "setup.autoInstallEngines"

export type SettingsShape = {
  "ui.fullscreen": boolean;
  "controls.activeProfileId": string;
  "launch.closeOnExit": boolean;
  "launch.fullscreen": boolean;
  "launch.resolution": number;
  "setup.autoInstallEngines": boolean;
};

export const SETTINGS_DEFAULTS: SettingsShape = {
  "ui.fullscreen": false,
  "controls.activeProfileId": "",
  "launch.closeOnExit": false,
  "launch.fullscreen": false,
  "launch.resolution": 0,
  "setup.autoInstallEngines": true,
};