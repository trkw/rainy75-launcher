import { useContext, useMemo } from "react";

import type { RpcTransport } from "@zmkfirmware/zmk-studio-ts-client/transport/index";
import type { AvailableDevice } from "./tauri/index";
import { LockStateContext } from "./rpc/LockStateContext";
import { LockState } from "@zmkfirmware/zmk-studio-ts-client/core";
import { ConnectionContext } from "./rpc/ConnectionContext";
import { useModalRef } from "./misc/useModalRef";
import { GenericModal } from "./GenericModal";
import { ExternalLink } from "./misc/ExternalLink";

export type TransportFactory = {
  label: string;
  connect?: () => Promise<RpcTransport>;
  pick_and_connect?: {
    list: () => Promise<Array<AvailableDevice>>;
    connect: (dev: AvailableDevice) => Promise<RpcTransport>;
  };
};

export interface UnlockModalProps {}

export const UnlockModal = ({}: UnlockModalProps) => {
  let conn = useContext(ConnectionContext);
  let lockState = useContext(LockStateContext);

  let open = useMemo(
    () =>
      !!conn.conn && lockState != LockState.ZMK_STUDIO_CORE_LOCK_STATE_UNLOCKED,
    [conn, lockState]
  );
  const dialog = useModalRef(open, false, false);

  return (
    <GenericModal ref={dialog}>
      <h1 className="text-xl">Unlock To Continue</h1>
      <p>
        For security reasons, the keyboard must be unlocked before the keymap
        can be edited.
      </p>
      <p>
        On the Rainy 75, hold <b>Fn</b> and press <b>Esc</b> once. The launcher
        unlocks as soon as the keyboard reports it.
      </p>
      <p>
        If that combination was removed from your keymap, see the{" "}
        <ExternalLink href="https://zmk.dev/docs/keymaps/behaviors/studio-unlock">
          Studio Unlock Behavior
        </ExternalLink>{" "}
        documentation.
      </p>
    </GenericModal>
  );
};
