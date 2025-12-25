import { useEffect, useMemo, useState, useCallback } from "react";
import type { ActionBindings, LogicalAction, PhysicalBinding, ActionDef } from "../../shared/types/controls";
import { controlsClient } from "../clients/controlsClient";
import { STANDARD_LAYOUT, SECTION_ORDER } from "../config/controllerLayouts";

type ProfileMeta = {
  id: string;
  name: string;
  is_default: number;
};

type Profile = ProfileMeta & {
  bindings: ActionBindings;
};

export function useControlsPage() {
  const [profiles, setProfiles] = useState<ProfileMeta[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [bindings, setBindings] = useState<ActionBindings | null>(null);

  const refreshProfiles = useCallback(async () => {
    const list = await controlsClient.getProfiles();
    setProfiles(list);
    return list;
  }, []);

  const load = useCallback(async () => {
    await refreshProfiles();

    const defaultProfile = await controlsClient.getDefaultProfile();
    setActiveProfileId(defaultProfile.id);
    setBindings(defaultProfile.bindings);
  }, [refreshProfiles]);

  useEffect(() => {
    load();
  }, [load]);

  const itemsBySection = useMemo(() => {
    const map = new Map<string, ActionDef[]>();

    for (const s of SECTION_ORDER) {
      map.set(s.key, []);
    }

    if (!map.has("system")) {
      map.set("system", []);
    }

    for (const item of STANDARD_LAYOUT) {
      const secKey = item.section && map.has(item.section) ? item.section : "system";
      
      const list = map.get(secKey);

      if (list) {
        list.push(item);
      }
    }
    return map;
  }, []);

  const guidedOrder = useMemo(() => {
    return SECTION_ORDER.flatMap((sec) => {
      const items = itemsBySection.get(sec.key);
      if (!items) return [];
      
      return items.map((i) => i.id);
    });
  }, [itemsBySection]);

  const changeProfile = useCallback(async (id: string) => {
    try {
      const p: Profile = await controlsClient.getProfile(id);
      setActiveProfileId(p.id);
      setBindings(p.bindings);
    } catch (e) {
      console.error("Failed to load profile", e);
      load();
    }
  }, [load]);

  const createProfile = useCallback(async (name: string, copyCurrent = true) => {
    const newProfile = await controlsClient.createProfile({
      name,
      copyFromId: copyCurrent && activeProfileId ? activeProfileId : undefined,
    });
    await refreshProfiles();
    await changeProfile(newProfile.id);
  }, [activeProfileId, refreshProfiles, changeProfile]);

  const renameProfile = useCallback(async (id: string, newName: string) => {
    await controlsClient.renameProfile({ id, name: newName });
    await refreshProfiles();
  }, [refreshProfiles]);

  const deleteProfile = useCallback(async (id: string) => {
    await controlsClient.deleteProfile(id);
    const list = await refreshProfiles();
    
    if (activeProfileId === id) {
      const def = list.find(p => p.is_default) || list[0];
      if (def) await changeProfile(def.id);
    }
  }, [activeProfileId, refreshProfiles, changeProfile]);

  const setAsDefault = useCallback(async (id: string) => {
    await controlsClient.setDefault(id);
    await refreshProfiles();
  }, [refreshProfiles]);

  const bindAction = useCallback(
    async (action: LogicalAction, input: PhysicalBinding) => {
      if (!activeProfileId) return;
      const updated: Profile = await controlsClient.bindAction({
        profileId: activeProfileId,
        action,
        input,
      });
      setBindings(updated.bindings);
    },
    [activeProfileId]
  );

  const clearAction = useCallback(
    async (action: LogicalAction) => {
      if (!activeProfileId) return;
      const updated: Profile = await controlsClient.clearAction({ profileId: activeProfileId, action });
      setBindings(updated.bindings);
    },
    [activeProfileId]
  );

  const resetAll = useCallback(async () => {
    if (!activeProfileId) return;
    const updated: Profile = await controlsClient.resetAll(activeProfileId);
    setBindings(updated.bindings);
  }, [activeProfileId]);

  return {
    profiles,
    activeProfileId,
    bindings,

    itemsBySection,
    guidedOrder,

    changeProfile,
    createProfile,
    renameProfile,
    deleteProfile,
    setAsDefault,

    bindAction,
    clearAction,
    resetAll,
  };
}