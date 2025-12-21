export interface PlatformHandler {

  /** extracts downloaded archive */
  extractArchive(filePath: string, destDir: string): Promise<void>;
  
  /**  post install cleanup  */
  finalizeInstall(binaryPath: string): Promise<void>;
  
  /** extracts and installs a dependency */
  installDependency(filePath: string, targetDir: string, searchName: string, targetFilename: string): Promise<void>;
  
  /** finds binary */
  resolveBinaryPath(installDir: string, binaryConfigPath: string): Promise<string>;

  /** cleans up config files */
  clearPlatformData(): void;
}