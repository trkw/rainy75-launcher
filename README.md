# Rainy75 Launcher

An unofficial, Keychron-Launcher-style web configurator for the **Wobkey
Rainy 75** running **ZMK**.

It is a fork of [ZMK Studio](https://github.com/zmkfirmware/zmk-studio) with a
Rainy 75 UI, a Mac/Windows preset, and a settings tab for the firmware's
runtime settings.

> **Unofficial.** Not affiliated with Wobkey, Telink, Evision, or the ZMK
> project. Use at your own risk.

## Status

| Feature | State |
|---|---|
| Keymap editing (layers, behaviors, save/discard) | ✅ ZMK Studio |
| Rainy 75 Mac/Windows mode (`kb.os`) | ✅ settings tab |
| USB Web Serial | ✅ |
| Keymap export/import | ⏳ planned |
| Lighting UI | 🔗 links to the upstream settings page for now |
| Firmware update | 🔗 links to the macOS setup repo for now |
| Bluetooth | ❌ web app is USB-only on macOS |
| Stock Evision / VIA firmware | ❌ ZMK only |

## Use it

Open **https://trkw.github.io/rainy75-launcher/** in Chrome or Edge.

1. Connect the Rainy 75 with a USB-C data cable.
2. Power switch under CapsLock **on**.
3. `Fn + Tab` until Esc lights up (wired mode).
4. Choose the keyboard's **Studio** serial port for the Keymap tab.
5. Press `Fn + Esc` on the keyboard to unlock editing.
6. For **Settings → Computer**, choose the **console** serial port when asked.

The Rainy 75 exposes two CDC-ACM ports with the same name. The Keymap tab needs
the Studio port; the Settings tab needs the console port. If the picker shows
two identical “Rainy 75” entries and the first one does not answer, try the
other one.

## What the tabs do

- **Keymap** — ZMK Studio's keymap editor. Layers, key picker, save/discard.
- **Settings** — Rainy 75-specific runtime settings. Currently Mac/Windows
  mode (`kb.os`), which turns the left Win/Alt keys into Option/Command.
- **Lighting** — opens the upstream full settings page (RGB, sleep,
  indicators) until those controls are integrated here.
- **Firmware** — opens the macOS build/flash setup repository.

## Development

```bash
npm ci
npm run dev
```

Vite serves at <http://localhost:5173>. Open it in Chrome/Edge.

Production build:

```bash
npm run build
```

The GitHub Pages workflow builds with `GITHUB_ACTIONS=true`, which sets the
Vite base path to `/rainy75-launcher/`.

## Roadmap

- Keymap JSON export/import (ZMK Studio has no export; this is the main reason
  for a custom launcher).
- Integrated RGB / sleep / indicator settings (port the upstream `group 67`
  settings UI).
- Firmware update over Web Serial (SMP/mcumgr DFU).
- Japanese UI.
- Keymap presets for macOS (CapsLock→Ctrl, etc.).
- Optional: stock Evision/VIA detection and a migration path.

## Credits

- [ZMK Studio](https://github.com/zmkfirmware/zmk-studio) — the keymap editor
  this launcher is forked from, Apache-2.0.
- [scholzri/rainy75-zmk](https://github.com/scholzri/rainy75-zmk) — Rainy 75
  ZMK firmware, reverse engineering, and the `group 67` settings protocol.
- [trkw/rainy75-zmk-macos](https://github.com/trkw/rainy75-zmk-macos) — native
  macOS build and flash setup.
- Rainy 75 is a product of Wobkey.

See [NOTICE](NOTICE) and [LICENSE](LICENSE).
