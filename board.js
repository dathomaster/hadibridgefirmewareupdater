// The 3D RP2350-USB-A on the page: built from plain divs with CSS 3D transforms (no libraries).
// Sizes are the real board's, in mm (33 x 17.5 mm), drawn at S px per mm.
// Drag to turn it; it sways slowly on its own unless the user prefers reduced motion.

const S = 12;
const W = 17.5 * S;
const H = 33 * S;
const T = 1.6 * S; // PCB thickness

const PARTS = {
    usbc: { name: 'USB-C', text: 'Plugs into the computer to load firmware, and into the iPhone when you use it.' },
    usba: { name: 'USB-A', text: "The HADI's USB cable plugs in here." },
    boot: { name: 'BOOT button', text: 'Hold it while you plug the board in to get it ready for new firmware.' },
    rst:  { name: 'RST button', text: 'Restarts the board. Not needed for flashing.' },
    led:  { name: 'RGB LED', text: 'Status light (GP16).' },
    chip: { name: 'RP2350 chip', text: "The board's processor, with 2 MB of flash memory for the firmware." },
    pins: { name: 'Pins', text: '15 GPIO pins plus 5V, 3V3 and GND. You don’t need them for the bridge: nothing to solder.' },
};

const LEFT_PINS = ['5V', 'GND', '3V3', '29', '28', '27', '26', '10', '9'];
const RIGHT_PINS = ['0', '1', '2', '3', '4', '5', '6', '7', '8'];
const PIN_Y0 = 4.2;     // mm, first pad
const PITCH = 2.54;     // mm

const el = (tag, cls, style = {}) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    Object.assign(e.style, style);
    return e;
};
const px = (n) => `${n}px`;

/** A box with its top face at height z0 + d above the board. x, y, w, h, d in mm. */
function cuboid({ x, y, w, h, d, z0 = 0, cls, part, faces = {} }) {
    const [bw, bh, bd] = [w * S, h * S, d * S];
    const box = el('div', `box ${cls}`, {
        left: px(x * S), top: px(y * S), width: px(bw), height: px(bh),
        transform: `translateZ(${z0 * S}px)`,
    });
    if (part) box.dataset.part = part;
    const face = (name, fw, fh, transform) => {
        const f = el('div', `face ${name}`, {
            width: px(fw), height: px(fh), left: px((bw - fw) / 2), top: px((bh - fh) / 2), transform,
        });
        if (faces[name]) f.innerHTML = faces[name];
        box.append(f);
    };
    face('back', bw, bd, `translateZ(${bd / 2}px) rotateX(90deg) translateZ(${bh / 2}px)`);
    face('left', bd, bh, `translateZ(${bd / 2}px) rotateY(-90deg) translateZ(${bw / 2}px)`);
    face('right', bd, bh, `translateZ(${bd / 2}px) rotateY(90deg) translateZ(${bw / 2}px)`);
    face('front', bw, bd, `translateZ(${bd / 2}px) rotateX(-90deg) translateZ(${bh / 2}px)`);
    face('top', bw, bh, `translateZ(${bd}px)`);
    return box;
}

/** The PCB's top: solder mask, castellated pads, silkscreen. */
function pcbArt() {
    const pads = [];
    for (let i = 0; i < 9; i++) {
        const y = (PIN_Y0 + i * PITCH) * S;
        for (const x of [0, W]) {
            pads.push(`<circle cx="${x}" cy="${y}" r="${0.9 * S}" class="pad"/><circle cx="${x}" cy="${y}" r="${0.45 * S}" class="hole"/>`);
        }
    }
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
      <defs>
        <linearGradient id="mask" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#2a6fc4"/><stop offset="1" stop-color="#174f96"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" rx="${1.2 * S}" fill="url(#mask)"/>
      <g class="trace" fill="none">
        <path d="M ${8.75 * S} ${6.2 * S} V ${11 * S}"/><path d="M ${7.8 * S} ${6.2 * S} V ${11 * S}"/>
        <path d="M ${2.2 * S} ${PIN_Y0 * S} H ${3.4 * S} V ${11.2 * S}"/>
        <path d="M ${W - 2.2 * S} ${(PIN_Y0 + 2 * PITCH) * S} H ${14.6 * S} V ${11 * S}"/>
        <path d="M ${6 * S} ${18 * S} V ${21.6 * S}"/><path d="M ${11.5 * S} ${18 * S} V ${21.6 * S}"/>
      </g>
      ${pads.join('')}
      <g class="silk">
        <text x="${4.5 * S}" y="${7.1 * S}" text-anchor="middle">BOOT</text>
        <text x="${13 * S}" y="${7.1 * S}" text-anchor="middle">RST</text>
        <rect x="${2.7 * S}" y="${7.5 * S}" width="${3.6 * S}" height="${3.6 * S}" rx="3"/>
        <rect x="${11.2 * S}" y="${7.5 * S}" width="${3.6 * S}" height="${3.6 * S}" rx="3"/>
      </g>
      <text class="model" x="${W / 2}" y="${H - 0.9 * S}" text-anchor="middle">RP2350-USB-A</text>
    </svg>`;
}

const USBC_FRONT = '<div class="usbc-slot"><i></i></div>';
const USBA_FRONT = '<div class="usba-mouth"><i></i></div>';
const CHIP_TOP = '<div class="chip-print"><span class="dot"></span><b>RP2350</b><small>A0A2 · 2 MB</small></div>';
const CAP_TOP = '<div class="cap"></div>';

export function mountBoard(stage, info) {
    const scene = el('div', 'scene');
    const plane = el('div', 'plane', { width: px(W), height: px(H), marginLeft: px(-W / 2), marginTop: px(-H / 2) });
    scene.append(el('div', 'shadow'));
    stage.append(scene);
    scene.append(plane);

    // PCB slab, its top face being the artwork
    plane.append(cuboid({ x: 0, y: 0, w: 17.5, h: 33, d: 1.6, z0: -1.6, cls: 'pcb', faces: { top: pcbArt() } }));

    // Parts (positions taken from the real board, mm)
    plane.append(cuboid({ x: 4.28, y: -1.2, w: 8.94, h: 7.35, d: 3.2, cls: 'metal usbc', part: 'usbc', faces: { back: USBC_FRONT } }));
    plane.append(cuboid({ x: 3.0, y: 7.8, w: 3.0, h: 3.0, d: 0.9, cls: 'tact', part: 'boot', faces: { top: CAP_TOP } }));
    plane.append(cuboid({ x: 11.5, y: 7.8, w: 3.0, h: 3.0, d: 0.9, cls: 'tact', part: 'rst', faces: { top: CAP_TOP } }));
    plane.append(cuboid({ x: 2.0, y: 12.0, w: 2.6, h: 2.0, d: 0.8, cls: 'xtal' }));
    plane.append(cuboid({ x: 14.0, y: 12.2, w: 1.6, h: 1.6, d: 0.6, cls: 'led', part: 'led' }));
    plane.append(cuboid({ x: 5.25, y: 11.0, w: 7.0, h: 7.0, d: 0.9, cls: 'chip', part: 'chip', faces: { top: CHIP_TOP } }));
    for (const [x, y] of [[3, 19], [13.6, 19], [3, 20.6], [13.6, 20.6]]) {
        plane.append(cuboid({ x, y, w: 1.0, h: 0.6, d: 0.5, cls: 'smd' }));
    }
    plane.append(cuboid({ x: 2.2, y: 22.0, w: 13.1, h: 14.0, d: 5.8, cls: 'metal usba', part: 'usba', faces: { front: USBA_FRONT } }));

    // Pin labels, lying on the board's plane just outside each edge
    // The layer is made wider than the board: Chrome clips a 3D layer to its own box.
    const M = 80;
    const pins = el('div', 'pins', { left: px(-M), width: px(W + 2 * M), height: px(H) });
    pins.dataset.part = 'pins';
    const kind = (p) => (p === '5V' ? 'pwr' : p === '3V3' ? 'pwr3' : p === 'GND' ? 'gnd' : 'gpio');
    LEFT_PINS.forEach((p, i) => {
        const tag = el('span', `pin left ${kind(p)}`, { top: px((PIN_Y0 + i * PITCH) * S), right: px(W + M + 12) });
        tag.textContent = /^\d+$/.test(p) ? `GP${p}` : p;
        pins.append(tag);
    });
    RIGHT_PINS.forEach((p, i) => {
        const tag = el('span', `pin right ${kind(p)}`, { top: px((PIN_Y0 + i * PITCH) * S), left: px(W + M + 12) });
        tag.textContent = `GP${p}`;
        pins.append(tag);
    });
    plane.append(pins);

    // Floating name tag for the highlighted part
    const tag = el('div', 'part-tag');
    stage.append(tag);

    // ---- motion ----
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rx = 50, rz = -32, scale = 1;
    let dragging = false, last = null, idleSince = performance.now() - 10000, start = performance.now();
    let active = null;

    const fit = () => { scale = Math.min(0.92, stage.clientWidth / 500); };
    fit();
    addEventListener('resize', fit);

    let moved = 0;
    stage.addEventListener('pointerdown', (e) => {
        dragging = true; last = [e.clientX, e.clientY]; moved = 0;
        stage.setPointerCapture(e.pointerId);
        stage.classList.add('grabbing');
    });
    stage.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        moved += Math.abs(e.clientX - last[0]) + Math.abs(e.clientY - last[1]);
        rz -= (e.clientX - last[0]) * 0.45;
        rx = Math.max(8, Math.min(82, rx - (e.clientY - last[1]) * 0.35));
        last = [e.clientX, e.clientY];
    });
    const end = () => { dragging = false; idleSince = performance.now(); stage.classList.remove('grabbing'); };
    stage.addEventListener('pointerup', (e) => {
        const wasClick = moved < 6;
        end();
        if (!wasClick) return;
        // pointer capture sends the click to the stage, so find the part under the pointer ourselves
        const hit = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.closest && n.closest('.plane [data-part]'));
        const p = hit && hit.closest('[data-part]');
        highlight(p && p.dataset.part !== active ? p.dataset.part : null);
    });
    stage.addEventListener('pointercancel', end);

    const frame = (now) => {
        let x = rx, z = rz;
        const t = (now - start) / 1000;
        if (!reduce && !dragging && now - idleSince > 2500) {
            z += Math.sin(t * 0.5) * 9;
            x += Math.sin(t * 0.37) * 4;
        }
        const intro = reduce ? 1 : Math.min(1, t / 1.2);
        const ease = 1 - Math.pow(1 - intro, 3);
        scene.style.transform = `scale(${scale * (0.9 + 0.1 * ease)}) rotateX(${x}deg) rotateZ(${z - (1 - ease) * 40}deg)`;
        scene.style.opacity = String(ease);
        placeTag();
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    function placeTag() {
        if (!active) { tag.classList.remove('show'); return; }
        const node = plane.querySelector(`[data-part="${active}"]`);
        if (!node) return;
        const r = node.getBoundingClientRect();
        const s = stage.getBoundingClientRect();
        tag.style.left = px(r.left + r.width / 2 - s.left);
        tag.style.top = px(Math.max(14, r.top - s.top - 10));
        tag.classList.add('show');
    }

    /** Lights up one part (or none), and says what it is under the board. */
    function highlight(part) {
        active = PARTS[part] ? part : null;
        plane.querySelectorAll('[data-part]').forEach((n) => n.classList.toggle('hl', n.dataset.part === active));
        stage.classList.toggle('dim', !!active);
        if (active) {
            tag.textContent = PARTS[active].name;
            info.innerHTML = `<strong>${PARTS[active].name}</strong> ${PARTS[active].text}`;
        } else {
            info.innerHTML = '<span class="hint">Drag to turn the board. Tap a part name to find it.</span>';
        }
        document.querySelectorAll('[data-show]').forEach((b) => b.classList.toggle('on', b.dataset.show === active));
    }

    highlight(null);
    return { highlight, get active() { return active; } };
}
