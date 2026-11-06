// HADI Bridge firmware flasher: the logic, with no page code in it so it can be tested without a browser.
//
// A UF2 file is read into one block of flash data, written to the board over PICOBOOT (the RP2350's built-in
// bootloader, via WebUSB), read back to check it, and then the board is restarted into the new firmware.

export const FLASH_START = 0x10000000;
const FLASH_END = 0x12000000;   // the RP2350 can address up to 32 MB of flash
const SECTOR = 0x1000;
const PAGE = 0x100;
// UF2 family ids that mean "RP2350 firmware": ARM secure, RISC-V, ARM non-secure.
const RP2350_FAMILIES = new Set([0xE48BFF59, 0xE48BFF5A, 0xE48BFF5B]);
// A flasher that writes more than this is almost certainly looking at the wrong file.
export const MAX_FIRMWARE_BYTES = 8 * 1024 * 1024;

const UF2_MAGIC_0 = 0x0A324655;
const UF2_MAGIC_1 = 0x9E5D5157;
const UF2_MAGIC_END = 0x0AB16F30;
const FLAG_NOT_MAIN_FLASH = 0x00000001;
const FLAG_FAMILY_ID_PRESENT = 0x00002000;

/**
 * Turns a UF2 file into the flash contents for an RP2350.
 *
 * Only blocks marked for an RP2350 family are used. The Pico SDK also puts a filler block of another family
 * ("absolute") at the very end of flash, which only matters for drag-and-drop; it is skipped, because writing
 * it would mean erasing and writing about 16 MB.
 *
 * @param {Uint8Array} bytes the whole .uf2 file
 * @returns {{address: number, data: Uint8Array, blocks: number}}
 */
export function parseUf2(bytes) {
    if (!bytes || bytes.length === 0 || bytes.length % 512 !== 0) {
        throw new Error('This is not a valid firmware file (a .uf2 file is made of 512-byte blocks).');
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const blocks = [];
    for (let off = 0; off < bytes.length; off += 512) {
        if (view.getUint32(off, true) !== UF2_MAGIC_0 || view.getUint32(off + 4, true) !== UF2_MAGIC_1
            || view.getUint32(off + 508, true) !== UF2_MAGIC_END) {
            throw new Error('The firmware file is damaged (a block has the wrong marker).');
        }
        const flags = view.getUint32(off + 8, true);
        const address = view.getUint32(off + 12, true);
        const size = view.getUint32(off + 16, true);
        const family = view.getUint32(off + 28, true);
        if (flags & FLAG_NOT_MAIN_FLASH) continue;
        if (!(flags & FLAG_FAMILY_ID_PRESENT) || !RP2350_FAMILIES.has(family)) continue;
        if (size === 0 || size > 476) throw new Error('The firmware file is damaged (a block has a bad size).');
        blocks.push({ address, size, payload: bytes.subarray(off + 32, off + 32 + size) });
    }
    if (blocks.length === 0) {
        throw new Error('This file has no RP2350 firmware in it.');
    }

    let start = Infinity;
    let end = 0;
    for (const b of blocks) {
        start = Math.min(start, b.address);
        end = Math.max(end, b.address + b.size);
    }
    if (start < FLASH_START || end > FLASH_END || start % SECTOR !== 0) {
        throw new Error('The firmware does not start at the beginning of flash memory.');
    }
    const span = Math.ceil((end - start) / PAGE) * PAGE;
    if (span > MAX_FIRMWARE_BYTES) {
        throw new Error('The firmware is unexpectedly large; refusing to write it.');
    }
    const data = new Uint8Array(span).fill(0xFF);   // 0xFF is what erased flash holds
    for (const b of blocks) data.set(b.payload, b.address - start);
    return { address: start, data, blocks: blocks.length };
}

/** True if the two byte arrays are identical. */
function sameBytes(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

/**
 * Writes the firmware, checks it by reading it back, and restarts the board.
 *
 * `onStep` is called with 'connect', 'write', 'verify' and 'reboot'. It throws if the write or the check fails
 * (the board is then still in its bootloader, so it can simply be tried again). A restart that can't be
 * confirmed is not an error once the check has passed: the board resets while the command is being answered.
 *
 * @param {object} picoboot a `Picoboot` from pkg/picoboot.js
 * @param {{address: number, data: Uint8Array}} firmware from parseUf2()
 * @param {(step: string) => void} [onStep]
 * @returns {Promise<{restarted: boolean}>}
 */
export async function flashFirmware(picoboot, firmware, onStep = () => {}) {
    let connection;
    let restarted = false;
    try {
        onStep('connect');
        connection = await picoboot.connect();

        onStep('write');
        await picoboot.flashEraseAndWrite(firmware.address, firmware.data);

        onStep('verify');
        const back = await picoboot.flashRead(firmware.address, firmware.data.length);
        if (!sameBytes(back, firmware.data)) {
            throw new Error('The board did not keep the firmware (the check after writing failed). '
                + 'Unplug it, hold the BOOT button while plugging it back in, and try again.');
        }

        onStep('reboot');
        try {
            await connection.reboot(100);
            restarted = true;
        } catch (e) {
            restarted = false;   // see above: the board resets mid-command
        }
    } finally {
        try { await picoboot.disconnect(); } catch (e) { /* the board has already gone */ }
    }
    return { restarted };
}

/**
 * Plain-language text for an error from the flasher or from WebUSB.
 * @param {Error} e
 * @returns {string}
 */
export function describeError(e) {
    const name = e && e.name;
    const message = (e && e.message) || String(e);
    if (name === 'NotFoundError') {
        return 'No board was selected. Put the board in BOOT mode (unplug it, hold the BOOT button while plugging it in), '
            + 'then click Flash again and pick it in the list.';
    }
    if (/access denied|permission|claim|busy|in use/i.test(message)) {
        return 'The computer would not let the browser use the board. Close any other program that might be using it '
            + '(a serial monitor, picotool, another browser tab). On Linux, a one-time USB permission rule may be needed. '
            + `(${message})`;
    }
    return message;
}
