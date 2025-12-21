export interface EmulatorConfigurator {
  /** runs before the emulator process spawns to config emulator */
  configure(): Promise<void>;
}