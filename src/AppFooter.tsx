export interface AppFooterProps {
  onShowAbout: () => void;
  onShowLicenseNotice: () => void;
}

export const AppFooter = ({
  onShowAbout,
  onShowLicenseNotice,
}: AppFooterProps) => {
  return (
    <div className="grid justify-center p-1 bg-base-200">
      <div className="text-xs">
        <span>Rainy75 Launcher (unofficial)</span> -{" "}
        <a
          className="hover:text-primary hover:cursor-pointer"
          onClick={onShowAbout}
        >
          About
        </a>{" "}
        -{" "}
        <a
          className="hover:text-primary hover:cursor-pointer"
          onClick={onShowLicenseNotice}
        >
          License NOTICE
        </a>{" "}
        -{" "}
        <a
          className="hover:text-primary hover:cursor-pointer"
          href="https://github.com/trkw/rainy75-launcher"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </div>
    </div>
  );
};
