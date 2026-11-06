# HADI Bridge firmware updater

A one-page web flasher that loads the HADI Bridge firmware onto a Waveshare RP2350-USB-A board over WebUSB
(Chrome, Edge or Brave on a computer), with a drag-and-drop fallback for other browsers.

Live page: https://dathomaster.github.io/hadibridgefirmewareupdater/

This repo is the published copy of `firmware/web` from the main HADI Bridge project. To update the firmware,
replace `hadi_bridge.uf2` and change the "Firmware built …" date in `index.html`.

PICOBOOT/WebUSB code in `pkg/` is from [picoflash](https://github.com/piersfinlayson/picoflash) (MIT, see `pkg/LICENSE-picoboot.txt`).
