import { getPlayerControllerId, withPlayerControllerId, getSupportedControllers } from "../../../src/shared/controls/controllerModels";

describe("controllerModels per-player controller id", () => {
  describe("getPlayerControllerId", () => {
    it("reads player1 from the base controllerId field", () => {
      expect(getPlayerControllerId({ controllerIds: ["classic"] }, "player1")).toBe("classic");
    });

    it("reads each player from its own slot", () => {
      const source = {
        controllerIds: ["classic", "wiimote_nunchuk", "wiimote_sideways", "gamecube"],
      };
      expect(getPlayerControllerId(source, "player2")).toBe("wiimote_nunchuk");
      expect(getPlayerControllerId(source, "player3")).toBe("wiimote_sideways");
      expect(getPlayerControllerId(source, "player4")).toBe("gamecube");
    });

    it("returns undefined for players with no controller model set yet", () => {
      expect(getPlayerControllerId({ controllerIds: ["classic"] }, "player2")).toBeUndefined();
    });
  });

  describe("withPlayerControllerId", () => {
    it("sets player1's controller without touching other players", () => {
      const before = { controllerIds: ["wiimote", "wiimote_nunchuk"] };
      const after = withPlayerControllerId(before, "player1", "classic");

      expect(after.controllerIds?.[0]).toBe("classic");
      expect(after.controllerIds?.[1]).toBe("wiimote_nunchuk");
    });

    it("sets player2's controller without touching player1's", () => {
      const before = { controllerIds: ["classic", "wiimote"] };
      const after = withPlayerControllerId(before, "player2", "wiimote_nunchuk");

      expect(after.controllerIds?.[0]).toBe("classic");
      expect(after.controllerIds?.[1]).toBe("wiimote_nunchuk");
    });

    it("does not mutate the source object (pure update)", () => {
      const before = { controllerIds: ["wiimote"] };
      withPlayerControllerId(before, "player1", "classic");
      // the array itself is copied, not written through
      expect(before.controllerIds[0]).toBe("wiimote");
    });
  });

  it("Wii exposes all 5 controller models the picker can choose between", () => {
    const ids = getSupportedControllers("wii").map(c => c.id);
    expect(ids).toEqual(
      expect.arrayContaining(["wiimote", "wiimote_sideways", "wiimote_nunchuk", "classic", "gamecube"])
    );
  });
});
