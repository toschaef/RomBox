import { getPlayerControllerId, withPlayerControllerId, getSupportedControllers } from "../../../src/shared/controls/controllerModels";

describe("controllerModels per-player controller id", () => {
  describe("getPlayerControllerId", () => {
    it("reads player1 from the base controllerId field", () => {
      expect(getPlayerControllerId({ controllerId: "classic" }, "player1")).toBe("classic");
    });

    it("reads player2/3/4 from their own dedicated fields", () => {
      const source = {
        controllerId: "classic",
        player2ControllerId: "wiimote_nunchuk",
        player3ControllerId: "wiimote_sideways",
        player4ControllerId: "gamecube",
      };
      expect(getPlayerControllerId(source, "player2")).toBe("wiimote_nunchuk");
      expect(getPlayerControllerId(source, "player3")).toBe("wiimote_sideways");
      expect(getPlayerControllerId(source, "player4")).toBe("gamecube");
    });

    it("returns undefined for players with no controller model set yet", () => {
      expect(getPlayerControllerId({ controllerId: "classic" }, "player2")).toBeUndefined();
    });
  });

  describe("withPlayerControllerId", () => {
    it("sets player1's controllerId without touching other players", () => {
      const before = { controllerId: "wiimote", player2ControllerId: "wiimote_nunchuk" };
      const after = withPlayerControllerId(before, "player1", "classic");

      expect(after.controllerId).toBe("classic");
      expect(after.player2ControllerId).toBe("wiimote_nunchuk");
    });

    it("sets player2's controllerId without touching player1's", () => {
      const before = { controllerId: "classic", player2ControllerId: "wiimote" };
      const after = withPlayerControllerId(before, "player2", "wiimote_nunchuk");

      expect(after.controllerId).toBe("classic");
      expect(after.player2ControllerId).toBe("wiimote_nunchuk");
    });

    it("does not mutate the source object (pure update)", () => {
      const before = { controllerId: "wiimote" };
      withPlayerControllerId(before, "player1", "classic");
      expect(before.controllerId).toBe("wiimote");
    });
  });

  it("Wii exposes all 5 controller models the picker can choose between", () => {
    const ids = getSupportedControllers("wii").map(c => c.id);
    expect(ids).toEqual(
      expect.arrayContaining(["wiimote", "wiimote_sideways", "wiimote_nunchuk", "classic", "gamecube"])
    );
  });
});
