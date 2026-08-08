import type {
  ControlsProfile,
  ConsoleLayout,
  ConsoleLayoutMeta,
  ControllerProfileMeta,
  PlayerBindings,
} from "../../shared/types/controls";
import type { ConsoleID } from "../../shared/types";
import {
  createDefaultProfileShape,
  makeDefaultConsoleBindings,
  applyConsoleSpecial,
} from "../../shared/controls/layoutDefaults";
import { profilesRepository } from "../data/repositories/ProfilesRepository";
import {
  layoutsRepository,
  type LayoutPlayers,
} from "../data/repositories/LayoutsRepository";

function now() {
  return Date.now();
}

// folds an override onto a base set of bindings, one control group at a time
function mergePlayerBindings(
  base: PlayerBindings | undefined,
  override: PlayerBindings
): PlayerBindings {
  if (!base) return override;

  const out = { ...base } as Record<string, unknown>;
  const isPlainObject = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);

  for (const [group, value] of Object.entries(override as Record<string, unknown>)) {
    const existing = out[group];
    out[group] =
      isPlainObject(value) && isPlainObject(existing)
        ? { ...(existing as object), ...(value as object) }
        : value;
  }

  return out as PlayerBindings;
}

export class ControlsService {
  ensureDefaultProfileExists(): string {
    const existing = profilesRepository.findDefaultId();
    if (existing) return existing;

    return profilesRepository.insert({
      name: "Default",
      payload: createDefaultProfileShape(),
      makeDefault: true,
      timestamp: now(),
    });
  }

  getProfiles(): ControllerProfileMeta[] {
    this.ensureDefaultProfileExists();
    return profilesRepository.listMeta();
  }

  getProfile(id: string): ControlsProfile {
    const profile = profilesRepository.findById(id);
    if (!profile) throw new Error(`Profile not found: ${id}`);
    return profile;
  }

  getDefaultProfile(): ControlsProfile {
    const id = this.ensureDefaultProfileExists();
    const profile = profilesRepository.findById(id);
    if (!profile) throw new Error("Default profile could not be found or created.");
    return profile;
  }

  createProfile(payload: {
    name: string;
    copyFromId?: string;
    makeDefault?: boolean;
  }): ControlsProfile {
    const source = payload.copyFromId ? this.getProfile(payload.copyFromId) : null;

    const id = profilesRepository.insert({
      name: payload.name,
      payload: source
        ? {
            preferredDevice: source.preferredDevice,
            player1: source.player1,
            player2: source.player2,
            player3: source.player3,
            player4: source.player4,
          }
        : createDefaultProfileShape(),
      makeDefault: Boolean(payload.makeDefault),
      timestamp: now(),
    });

    return this.getProfile(id);
  }

  renameProfile(id: string, name: string): ControlsProfile {
    if (!profilesRepository.rename(id, name, now())) {
      throw new Error(`Profile not found: ${id}`);
    }
    return this.getProfile(id);
  }

  setDefault(id: string): ControlsProfile {
    if (!profilesRepository.setDefault(id, now())) {
      throw new Error(`Profile not found: ${id}`);
    }
    return this.getProfile(id);
  }

  deleteProfile(id: string): { ok: true } {
    const wasDefault = profilesRepository.isDefault(id);
    if (wasDefault === null) throw new Error(`Profile not found: ${id}`);

    profilesRepository.deleteWithLayouts(id);

    // the unique index guarantees a default exists; promote another profile,
    // or recreate one if that was the last.
    if (wasDefault) {
      const next = profilesRepository.findMostRecentlyUpdatedId();
      if (next) this.setDefault(next);
      else this.ensureDefaultProfileExists();
    }

    return { ok: true };
  }

  saveProfile(profile: ControlsProfile): ControlsProfile {
    const saved = profilesRepository.savePayload(
      profile.id,
      {
        preferredDevice: profile.preferredDevice,
        player1: profile.player1,
        player2: profile.player2,
        player3: profile.player3,
        player4: profile.player4,
      },
      now()
    );

    if (!saved) throw new Error(`Profile not found: ${profile.id}`);
    return this.getProfile(profile.id);
  }

  getConsoleLayout<C extends ConsoleID>(consoleId: C, profileId: string): ConsoleLayout<C> {
    const stored = layoutsRepository.find(consoleId, profileId);

    if (!stored) {
      return this.createDefaultConsoleLayout(consoleId, this.getProfile(profileId));
    }

    return {
      id: stored.id,
      consoleId,
      profileId: stored.profileId,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      isUserModified: stored.isUserModified,
      controllerIds: stored.controllerIds,
      player1: stored.players.player1,
      player2: stored.players.player2,
      player3: stored.players.player3,
      player4: stored.players.player4,
    };
  }

  saveConsoleLayout(args: {
    consoleId: ConsoleID;
    profileId: string;
    player1: PlayerBindings;
    player2?: PlayerBindings;
    player3?: PlayerBindings;
    player4?: PlayerBindings;
    controllerIds?: Array<string | undefined>;
  }): ConsoleLayout {
    const profile = this.getProfile(args.profileId);
    const existing = layoutsRepository.find(args.consoleId, args.profileId);
    const stored = existing?.players;

    // the first save for a console seeds from the profile, so groups the user
    // did not touch keep their profile bindings. Later saves are authoritative.
    const seed = (
      playerKey: "player2" | "player3" | "player4",
      incoming?: PlayerBindings
    ): PlayerBindings | undefined => {
      if (!incoming) return undefined;
      if (stored?.[playerKey]) return incoming;
      return mergePlayerBindings(profile[playerKey], incoming);
    };

    const players: LayoutPlayers = {
      player1: stored?.player1
        ? args.player1
        : mergePlayerBindings(profile.player1, args.player1),
      player2: seed("player2", args.player2),
      player3: seed("player3", args.player3),
      player4: seed("player4", args.player4),
    };

    const controllers = args.controllerIds ?? [];

    if (existing) {
      layoutsRepository.updateUserModified({
        id: existing.id,
        players,
        controllers,
        timestamp: now(),
      });
    } else {
      layoutsRepository.insertUserModified({
        consoleId: args.consoleId,
        profileId: args.profileId,
        players,
        controllers,
        timestamp: now(),
      });
    }

    return this.getConsoleLayout(args.consoleId, args.profileId);
  }

  resetConsoleLayout(consoleId: ConsoleID, profileId: string): ConsoleLayout {
    const profile = this.getProfile(profileId);
    const existing = layoutsRepository.find(consoleId, profileId);

    if (!existing) return this.createDefaultConsoleLayout(consoleId, profile);

    layoutsRepository.resetToDefaults(
      existing.id,
      { player1: makeDefaultConsoleBindings(consoleId, profile) },
      now()
    );

    return this.getConsoleLayout(consoleId, profileId);
  }

  getConsoleLayouts(profileId: string): ConsoleLayoutMeta[] {
    this.getProfile(profileId);
    return layoutsRepository.listForProfile(profileId);
  }

  private createDefaultConsoleLayout<C extends ConsoleID>(
    consoleId: C,
    profile: ControlsProfile
  ): ConsoleLayout<C> {
    layoutsRepository.insertDefault({
      consoleId,
      profileId: profile.id,
      players: { player1: makeDefaultConsoleBindings(consoleId, profile) },
      timestamp: now(),
    });

    return this.getConsoleLayout(consoleId, profile.id);
  }

  // the bindings an emulator should actually be configured with
  async getEffectiveConsoleLayout(
    consoleId: ConsoleID,
    profileId: string
  ): Promise<ConsoleLayout> {
    const profile = this.getProfile(profileId);
    const layout = this.getConsoleLayout(consoleId, profileId);

    const withSpecial = (b?: PlayerBindings): PlayerBindings | undefined =>
      b ? applyConsoleSpecial(consoleId, b) : undefined;

    if (!layout.isUserModified) {
      return {
        ...layout,
        player1: makeDefaultConsoleBindings(consoleId, profile),
        player2: withSpecial(profile.player2),
        player3: withSpecial(profile.player3),
        player4: withSpecial(profile.player4),
      };
    }

    return {
      ...layout,
      player1: applyConsoleSpecial(consoleId, layout.player1 ?? profile.player1),
      player2: withSpecial(layout.player2 ?? profile.player2),
      player3: withSpecial(layout.player3 ?? profile.player3),
      player4: withSpecial(layout.player4 ?? profile.player4),
    };
  }
}

/** The shared instance; all state lives in the profile and layout tables. */
export const controlsService = new ControlsService();
