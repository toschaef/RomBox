import { useCallback, useEffect, useMemo, useState } from "react";
import { controlsClient } from "../clients/controlsClient";
import type { ControlsProfile, ControllerProfileMeta } from "../../shared/controls/types";
import { createDefaultProfileShape } from "../../shared/controls/types";

function now() {
  return Date.now();
}

export function makeDefaultProfile(name: string): ControlsProfile {
  const base = createDefaultProfileShape();
  const ts = now();
  return {
    id: "local-temp",
    name,
    createdAt: ts,
    updatedAt: ts,
    isDefault: false,
    preferredDevice: base.preferredDevice,
    player1: base.player1,
  };
}

export function makeClearedProfile(p: ControlsProfile): ControlsProfile {
  const next = structuredClone(p);

  next.player1.face = { type: "face" };
  next.player1.shoulders = { type: "shoulders" };
  next.player1.system = { type: "system" };

  if (next.player1.move.type === "dpad") next.player1.move = { type: "dpad" };
  else next.player1.move = { type: "stick", stick: next.player1.move.stick, deadzone: next.player1.move.deadzone };

  next.player1.dpad = { type: "dpad" };

  if (next.player1.look.type === "dpad") next.player1.look = { type: "dpad" };
  else next.player1.look = { type: "stick", stick: next.player1.look.stick, deadzone: next.player1.look.deadzone };

  return next;
}

export function makeResetProfile(p: ControlsProfile): ControlsProfile {
  const base = createDefaultProfileShape();
  const next = structuredClone(p);
  next.preferredDevice = base.preferredDevice;
  next.player1 = structuredClone(base.player1);
  return next;
}

export function useControlsProfiles() {
  const [profiles, setProfiles] = useState<ControllerProfileMeta[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ControlsProfile | null>(null);
  const [saving, setSaving] = useState(false);

  const refreshProfiles = useCallback(async () => {
    const list = await controlsClient.getProfiles();
    setProfiles(list);
    return list;
  }, []);

  const loadDefault = useCallback(async () => {
    await refreshProfiles();
    const p = await controlsClient.getDefaultProfile();
    setActiveProfileId(p.id);
    setProfile(p);
  }, [refreshProfiles]);

  useEffect(() => {
    void loadDefault();
  }, [loadDefault]);

  const changeProfile = useCallback(async (id: string) => {
    const p = await controlsClient.getProfile(id);
    setActiveProfileId(p.id);
    setProfile(p);
  }, []);

  const createProfile = useCallback(
    async (name: string, copyCurrent = true) => {
      const created = await controlsClient.createProfile({
        name,
        copyFromId: copyCurrent && activeProfileId ? activeProfileId : undefined,
      });
      await refreshProfiles();
      await changeProfile(created.id);
    },
    [activeProfileId, refreshProfiles, changeProfile]
  );

  const renameProfile = useCallback(
    async (id: string, name: string) => {
      await controlsClient.renameProfile({ id, name });
      await refreshProfiles();
      setProfile((p) => (p && p.id === id ? { ...p, name } : p));
    },
    [refreshProfiles]
  );

  const deleteProfile = useCallback(
    async (id: string) => {
      await controlsClient.deleteProfile(id);
      const list = await refreshProfiles();
      if (activeProfileId === id) {
        const def = list.find((x) => x.is_default === 1) ?? list[0];
        if (def) await changeProfile(def.id);
        else await loadDefault();
      }
    },
    [activeProfileId, refreshProfiles, changeProfile, loadDefault]
  );

  const setAsDefault = useCallback(
    async (id: string) => {
      await controlsClient.setDefault(id);
      await refreshProfiles();
      setProfile((p) => (p ? { ...p, isDefault: p.id === id } : p));
    },
    [refreshProfiles]
  );

  const saveProfile = useCallback(async (next: ControlsProfile) => {
    setProfile(next);
    setSaving(true);
    try {
      const saved = await controlsClient.saveProfile(next);
      setProfile(saved);
    } finally {
      setSaving(false);
    }
  }, []);

  const metaById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const activeMeta = activeProfileId ? metaById.get(activeProfileId) : undefined;

  return {
    profiles,
    activeProfileId,
    activeMeta,
    profile,
    saving,

    refreshProfiles,
    loadDefault,
    changeProfile,
    createProfile,
    renameProfile,
    deleteProfile,
    setAsDefault,
    saveProfile,
    setProfile,
  };
}