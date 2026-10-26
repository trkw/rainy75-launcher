import { GenericModal } from "./GenericModal";
import { ExternalLink } from "./misc/ExternalLink";
import { useModalRef } from "./misc/useModalRef";

export interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export const AboutModal = ({ open, onClose }: AboutModalProps) => {
  const ref = useModalRef(open, true);

  return (
    <GenericModal ref={ref} className="min-w-min w-[45vw]" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">Rainy75 Launcher</h2>
          <button
            className="rounded-md bg-base-200 px-2 py-1 text-sm hover:bg-base-300"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p>
          An unofficial, macOS-friendly companion for the Wobkey Rainy 75
          running ZMK. Keymap editing is provided by ZMK Studio; the Rainy 75
          settings tab speaks the firmware's mcumgr settings protocol.
        </p>
        <ul className="list-inside list-disc text-sm">
          <li>
            <ExternalLink href="https://github.com/trkw/rainy75-launcher">
              Launcher source
            </ExternalLink>
          </li>
          <li>
            <ExternalLink href="https://github.com/scholzri/rainy75-zmk">
              Rainy 75 ZMK firmware and reverse engineering
            </ExternalLink>
          </li>
          <li>
            <ExternalLink href="https://github.com/trkw/rainy75-zmk-macos">
              macOS build and flashing setup
            </ExternalLink>
          </li>
          <li>
            <ExternalLink href="https://zmk.dev/docs/features/studio">
              ZMK Studio
            </ExternalLink>
          </li>
        </ul>
        <p className="text-xs opacity-70">
          Not affiliated with Wobkey, Telink, Evision, or the ZMK project. Built
          on ZMK Studio (Apache-2.0); see the License NOTICE for details.
        </p>
      </div>
    </GenericModal>
  );
};
