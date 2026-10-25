import { create } from "zustand";

/** Which social overlays are open; shared by the tools in the action stack and the overlays. */
export const useSocialUi = create<{ wheel: boolean; friends: boolean }>(() => ({
  wheel: false,
  friends: false,
}));
