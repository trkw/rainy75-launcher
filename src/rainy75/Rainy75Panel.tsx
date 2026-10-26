import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "../misc/ExternalLink";
import {
  ConfigClient,
  DeviceError,
  findConfigClient,
  TransportError,
} from "./smp";

type OsMode = "win" | "mac";

function errorText(error: unknown): string {
  if (error instanceof DeviceError) {
    return `The keyboard refused the setting (rc ${error.rc}).`;
  }
  if (error instanceof TransportError) {
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export function Rainy75Panel() {
  const clientRef = useRef<ConfigClient | null>(null);
  const [status, setStatus] = useState("Not connected");
  const [mode, setMode] = useState<OsMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      void clientRef.current?.close();
      clientRef.current = null;
    };
  }, []);

  async function connect(): Promise<ConfigClient> {
    let client = clientRef.current;
    if (client) return client;

    setBusy(true);
    setError(null);
    setStatus("Choose the Rainy 75 console port…");
    try {
      client = await findConfigClient();
      clientRef.current = client;
      const current = await client.getSetting("kb.os");
      setMode(current === "mac" ? "mac" : "win");
      setStatus("Connected to the settings port");
      return client;
    } catch (e) {
      setStatus("Not connected");
      setError(errorText(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function setOs(next: OsMode) {
    setBusy(true);
    setError(null);
    try {
      const client = await connect();
      const value = await client.setSetting("kb.os", next);
      setMode(value === "mac" ? "mac" : "win");
      setStatus("Saved on the keyboard");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await clientRef.current?.close();
    clientRef.current = null;
    setMode(null);
    setStatus("Not connected");
  }

  return (
    <div className="mx-auto h-full w-full max-w-3xl overflow-auto p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Rainy 75 settings</h1>
        <p className="mt-1 text-sm text-base-content/70">
          Rainy 75 specific settings that are not part of the ZMK keymap.
          Everything is stored on the keyboard.
        </p>
      </div>

      <section className="rounded-lg border border-base-300 bg-base-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">Computer</h2>
            <p className="mt-1 text-sm text-base-content/70">
              Mac mode turns the left <b>Win</b> key into <b>Option (⌥)</b> and
              the left <b>Alt</b> key into <b>Command (⌘)</b>. Right Alt stays
              AltGr.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className={`rounded px-3 py-2 text-sm ${
                mode === "win"
                  ? "bg-primary text-primary-content"
                  : "bg-base-100 hover:bg-base-300"
              }`}
              disabled={busy}
              onClick={() => setOs("win")}
            >
              Windows
            </button>
            <button
              className={`rounded px-3 py-2 text-sm ${
                mode === "mac"
                  ? "bg-primary text-primary-content"
                  : "bg-base-100 hover:bg-base-300"
              }`}
              disabled={busy}
              onClick={() => setOs("mac")}
            >
              Mac
            </button>
          </div>
        </div>
        <p className="mt-3 text-sm">
          Current:{" "}
          <span className="font-mono">
            {mode === null ? "unknown" : mode === "mac" ? "mac" : "win"}
          </span>
        </p>
      </section>

      <section className="mt-4 rounded-lg border border-base-300 bg-base-200 p-4">
        <h2 className="font-medium">Settings port</h2>
        <p className="mt-1 text-sm text-base-content/70">
          Rainy 75 exposes two USB serial ports. This page needs the{" "}
          <b>console</b> port, not the ZMK Studio port. If the picker shows two
          identical “Rainy 75” entries, try the other one.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            className="rounded bg-base-100 px-3 py-2 text-sm hover:bg-base-300 disabled:opacity-50"
            disabled={busy}
            onClick={() => connect().catch(() => {})}
          >
            {busy ? "Connecting…" : "Connect settings port"}
          </button>
          {clientRef.current && (
            <button
              className="rounded px-3 py-2 text-sm text-base-content/70 hover:bg-base-300"
              onClick={() => void disconnect()}
            >
              Disconnect
            </button>
          )}
          <span className="text-sm text-base-content/70">{status}</span>
        </div>
        {error && (
          <p className="mt-3 rounded bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </section>

      <section className="mt-4 rounded-lg border border-base-300 bg-base-200 p-4">
        <h2 className="font-medium">More settings</h2>
        <ul className="mt-2 list-inside list-disc text-sm">
          <li>
            <ExternalLink href="https://scholzri.github.io/rainy75-zmk/config/">
              RGB, sleep, indicators and the full settings page
            </ExternalLink>
          </li>
          <li>
            Use the <b>Keymap</b> tab for CapsLock→Ctrl, layers, and key
            assignments.
          </li>
          <li>
            <ExternalLink href="https://github.com/trkw/rainy75-zmk-macos">
              Firmware update and recovery
            </ExternalLink>
          </li>
        </ul>
      </section>

      <p className="mt-6 text-xs text-base-content/50">
        Unofficial companion for the Wobkey Rainy 75. Not affiliated with
        Wobkey. Built on ZMK Studio.
      </p>
    </div>
  );
}
