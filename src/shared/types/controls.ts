export type DeviceType = "keyboard" | "gamepad";

export type PhysicalBinding = {
  device: DeviceType;
  input: string; 
};

export type LogicalAction =
  | "MOVE_UP"
  | "MOVE_DOWN"
  | "MOVE_LEFT"
  | "MOVE_RIGHT"
  | "FACE_PRIMARY"
  | "FACE_SECONDARY"
  | "FACE_TERTIARY"
  | "FACE_QUATERNARY"
  | "BUMPER_L"
  | "BUMPER_R"
  | "TRIGGER_L"
  | "TRIGGER_R"
  | "START"
  | "SELECT";

export type ActionBindings = Record<LogicalAction, PhysicalBinding[]>;

export interface ActionDef {
  id: LogicalAction;
  label: string;
  icon: string;
  section: string;
}