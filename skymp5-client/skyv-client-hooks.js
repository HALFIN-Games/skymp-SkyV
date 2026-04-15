let sp;
try {
  sp = require('skyrimPlatform');
} catch {
  sp = globalThis.skyrimPlatform;
}

if (!sp) {
  throw new Error('skyrimPlatform global not found');
}

const { on, Utility, Game, Armor, writeLogs } = sp;

let fs;
let path;
try {
  fs = require('fs');
  path = require('path');
} catch {
}

const RAGGED_ROBES = 0x00013105;
const RAGGED_BOOTS = 0x00013106;

const RACE_MENU_NAMES = new Set([
  'RaceSex Menu',
  'RaceMenu',
]);

let raceMenuOpen = false;
let nextTickAt = 0;
let overlayToken = 0;

function clampPct(pct) {
  if (typeof pct !== 'number' || !Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function getLogoDataUrl() {
  try {
    if (!fs || !path || typeof __dirname !== 'string') return null;

    const svgPath = path.join(__dirname, 'skyv-loading-logo.svg');
    if (fs.existsSync(svgPath)) {
      const buf = fs.readFileSync(svgPath);
      const b64 = buf.toString('base64');
      return `data:image/svg+xml;base64,${b64}`;
    }

    const pngPath = path.join(__dirname, 'skyv-loading-logo.png');
    if (fs.existsSync(pngPath)) {
      const buf = fs.readFileSync(pngPath);
      const b64 = buf.toString('base64');
      return `data:image/png;base64,${b64}`;
    }

    return null;
  } catch {
    return null;
  }
}

function showOverlay() {
  const title = 'Vokun Roleplay';
  const logo = getLogoDataUrl();
  const js = `(() => {
    const id = 'skyv-loading-overlay';
    let root = document.getElementById(id);
    if (!root) {
      root = document.createElement('div');
      root.id = id;
      document.body.appendChild(root);
    }
    root.innerHTML = '';
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-family:Arial, sans-serif;'

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:18px;'

    const h = document.createElement('div');
    h.textContent = ${JSON.stringify(title)};
    h.style.cssText = 'font-size:34px;letter-spacing:1px;'
    wrap.appendChild(h);

    const img = document.createElement('img');
    const logoUrl = ${JSON.stringify(logo)};
    if (logoUrl) {
      img.src = logoUrl;
      img.style.cssText = 'width:220px;height:220px;object-fit:contain;';
      wrap.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.style.cssText = 'width:220px;height:220px;border:2px solid #333;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#777;';
      ph.textContent = 'LOGO';
      wrap.appendChild(ph);
    }

    const pct = document.createElement('div');
    pct.id = 'skyv-loading-pct';
    pct.textContent = '0%';
    pct.style.cssText = 'font-size:14px;color:#bbb;'
    wrap.appendChild(pct);

    const bar = document.createElement('div');
    bar.style.cssText = 'width:420px;height:10px;background:#222;border-radius:999px;overflow:hidden;'
    const fill = document.createElement('div');
    fill.id = 'skyv-loading-fill';
    fill.style.cssText = 'height:100%;width:0%;background:#fff;border-radius:999px;transition:width 120ms linear;'
    bar.appendChild(fill);
    wrap.appendChild(bar);
    root.appendChild(wrap);
  })();`;

  try {
    sp.browser.setFocused(false);
    sp.browser.setVisible(true);
    sp.browser.executeJavaScript(js);
  } catch {
  }
}

function setOverlayProgress(pct) {
  const v = clampPct(pct);
  const js = `(() => {
    const fill = document.getElementById('skyv-loading-fill');
    const pct = document.getElementById('skyv-loading-pct');
    if (fill) fill.style.width = '${v}%';
    if (pct) pct.textContent = '${v}%';
  })();`;
  try {
    sp.browser.executeJavaScript(js);
  } catch {
  }
}

function hideOverlay() {
  const js = `(() => {
    const el = document.getElementById('skyv-loading-overlay');
    if (el) el.remove();
  })();`;
  try {
    sp.browser.executeJavaScript(js);
    sp.browser.setVisible(false);
  } catch {
  }
}

function hideOverlayWithRetries() {
  let remaining = 8;
  const tick = () => {
    hideOverlay();
    remaining--;
    if (remaining > 0) Utility.wait(0.2).then(tick);
  };
  tick();
}

function log(...args) {
  try {
    writeLogs('skyv-client-hooks', ...args);
  } catch {
  }
}

function unequipSlot(pl, slot) {
  try {
    const item = pl.getEquippedArmorInSlot(slot);
    if (item) pl.unequipItem(item, false, true);
  } catch {
  }
}

function ensureAndEquipRags() {
  const pl = Game.getPlayer();
  if (!pl) return;

  for (let slot = 30; slot <= 61; slot++) {
    unequipSlot(pl, slot);
  }

  const robes = Armor.from(Game.getFormEx(RAGGED_ROBES));
  const boots = Armor.from(Game.getFormEx(RAGGED_BOOTS));

  if (robes) {
    pl.addItem(robes, 1, true);
    pl.equipItem(robes, false, true);
  }

  if (boots) {
    pl.addItem(boots, 1, true);
    pl.equipItem(boots, false, true);
  }
}

function equipRagsWithRetries(reason) {
  log('equipRagsWithRetries', reason);
  const token = overlayToken;
  let remaining = 18;

  const tick = () => {
    if (token !== overlayToken) return;
    ensureAndEquipRags();
    remaining--;
    if (remaining > 0) Utility.wait(0.15).then(tick);
  };

  Utility.wait(0.05).then(tick);
}

on('menuOpen', (e) => {
  if (!RACE_MENU_NAMES.has(e.name)) return;
  raceMenuOpen = true;
  nextTickAt = 0;
  overlayToken++;
  showOverlay();
  setOverlayProgress(5);
  equipRagsWithRetries('menuOpen:' + e.name);
  const token = overlayToken;

  Utility.wait(0.4).then(() => {
    if (token !== overlayToken) return;
    setOverlayProgress(35);
  });

  Utility.wait(0.9).then(() => {
    if (token !== overlayToken) return;
    setOverlayProgress(70);
  });

  Utility.wait(1.4).then(() => {
    if (token !== overlayToken) return;
    setOverlayProgress(100);
    hideOverlayWithRetries();
  });

  Utility.wait(4.0).then(() => {
    if (token !== overlayToken) return;
    hideOverlayWithRetries();
  });
});

on('menuClose', (e) => {
  if (!RACE_MENU_NAMES.has(e.name)) return;
  raceMenuOpen = false;
  overlayToken++;
  showOverlay();
  setOverlayProgress(80);
  equipRagsWithRetries('menuClose:' + e.name);
  const token = overlayToken;
  Utility.wait(0.25).then(() => {
    if (token !== overlayToken) return;
    setOverlayProgress(100);
    hideOverlayWithRetries();
  });
});
