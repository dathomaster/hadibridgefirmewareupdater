// The page: wires the buttons and messages to the flasher logic in flasher.js.
import { Picoboot } from './pkg/picoboot.js';
import { Target } from './pkg/target.js';
import { parseUf2, flashFirmware, describeError } from './flasher.js';
import { mountBoard } from './board.js';

const FIRMWARE_URL = './hadi_bridge.uf2';
const STEPS = ['connect', 'write', 'verify', 'reboot'];
const $ = (id) => document.getElementById(id);

const flashBtn = $('flash');
const boardLine = $('board');
const progress = $('progress');
const result = $('result');
const label = flashBtn.querySelector('.btn-label');
let firmware = null;
let flashing = false;

const hasWebUsb = 'usb' in navigator && window.isSecureContext;
const target = () => new Target('RP2350');

function showResult(kind, html) {
    result.className = kind;
    result.innerHTML = html;
    result.hidden = false;
}

function hideResult() {
    result.className = '';
    result.hidden = true;
}

function setStep(step) {
    progress.hidden = false;
    const at = STEPS.indexOf(step);
    progress.querySelectorAll('li').forEach((li) => {
        const i = STEPS.indexOf(li.dataset.step);
        li.className = i < at ? 'done' : i === at ? 'active' : '';
    });
}

function finishSteps() {
    progress.querySelectorAll('li').forEach((li) => { li.className = 'done'; });
}

/** Says whether a board already allowed by this browser is plugged in and waiting. */
async function refreshBoardLine() {
    if (!hasWebUsb || flashing) return;
    try {
        const devices = await Picoboot.getDevices([target()]);
        const ready = devices.length > 0;
        boardLine.classList.toggle('ready', ready);
        boardLine.textContent = ready
            ? 'Board found and ready. Go to step 3.'
            : 'Waiting for a board in BOOT mode…';
    } catch (e) {
        boardLine.textContent = '';
    }
}

/** Uses a board this browser already knows about, otherwise asks (the browser's own pop-up). */
async function pickBoard() {
    const known = await Picoboot.getDevices([target()]);
    if (known.length > 0) return known[0];
    return Picoboot.requestDevice([target()]);
}

async function onFlash() {
    if (flashing || !firmware) return;
    flashing = true;
    flashBtn.disabled = true;
    flashBtn.classList.add('busy');
    label.textContent = 'Flashing…';
    hideResult();
    progress.hidden = true;
    try {
        const picoboot = await pickBoard();
        const { restarted } = await flashFirmware(picoboot, firmware, setStep);
        finishSteps();
        showResult('ok', restarted
            ? '<strong>Done.</strong> The firmware is installed and the board has restarted. Unplug it from the computer and plug it into the iPhone.'
            : '<strong>Done.</strong> The firmware is installed and checked. Unplug the board and plug it back in (this time without holding the button).');
    } catch (e) {
        progress.hidden = true;
        const text = describeError(e).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
        showResult('bad', `<strong>Didn't work.</strong> ${text}<br><span class="small">Nothing is broken. Unplug the board and start again at step 1.</span>`);
    } finally {
        flashing = false;
        flashBtn.classList.remove('busy');
        label.textContent = 'Flash firmware';
        flashBtn.disabled = !firmware;
        refreshBoardLine();
    }
}

async function loadFirmware() {
    try {
        const response = await fetch(FIRMWARE_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        firmware = parseUf2(bytes);
        $('fwsize').textContent = `${Math.round(bytes.length / 1024)} KB`;
        flashBtn.disabled = !hasWebUsb;
    } catch (e) {
        showResult('bad', `<strong>The firmware file couldn't be loaded.</strong> Reload the page, or use the drag-and-drop method below. (${String(e.message).replace(/[&<>]/g, '')})`);
    }
}

// The 3D board, and the buttons and steps that point at its parts
// (only when the board is on the page)
if ($('stage')) {
    const board = mountBoard($('stage'), $('part-info'));
    document.querySelectorAll('[data-show]').forEach((b) => {
        b.addEventListener('click', () => board.highlight(board.active === b.dataset.show ? null : b.dataset.show));
    });
    document.querySelectorAll('.step[data-highlight]').forEach((s) => {
        s.addEventListener('mouseenter', () => board.highlight(s.dataset.highlight));
        s.addEventListener('mouseleave', () => board.highlight(null));
    });
}

if (!hasWebUsb) {
    $('unsupported').hidden = false;
} else {
    flashBtn.addEventListener('click', onFlash);
    navigator.usb.addEventListener('connect', refreshBoardLine);
    navigator.usb.addEventListener('disconnect', refreshBoardLine);
    refreshBoardLine();
}
loadFirmware();
