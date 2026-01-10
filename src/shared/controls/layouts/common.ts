import type { DpadBinding, StickBinding, FaceBinding, ShoulderBinding, DigitalBinding } from "../../types/controls";

export type SystemBindings = {
  start?: DigitalBinding;
  select?: DigitalBinding;
};

export type CommonBindings = {
  move?: DpadBinding | StickBinding;
  dpad?: DpadBinding | StickBinding;
  face?: FaceBinding;
  shoulders?: ShoulderBinding;
  system?: SystemBindings;
};