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

function getLogoDataUrl() {
  try {
    if (!fs || !path || typeof __dirname !== 'string') return null;
    const logoPath = path.join(__dirname, 'skyv-loading-logo.png');
    if (!fs.existsSync(logoPath)) return null;
    const buf = fs.readFileSync(logoPath);
    const b64 = buf.toString('base64');
    return `data:image/png;base64,${b64}`;
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

    const bar = document.createElement('div');
    bar.style.cssText = 'width:420px;height:10px;background:#222;border-radius:999px;overflow:hidden;'
    const fill = document.createElement('div');
    fill.style.cssText = 'height:100%;width:35%;background:#fff;border-radius:999px;animation:skyvLoad 1.1s ease-in-out infinite;'
    const styleId = 'skyv-loading-style';
    if (!document.getElementById(styleId)) {
      const st = document.createElement('style');
      st.id = styleId;
      st.textContent = '@keyframes skyvLoad{0%{transform:translateX(-120%);}50%{transform:translateX(120%);}100%{transform:translateX(320%);}}';
      document.head.appendChild(st);
    }
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

function hideOverlay() {
  const js = `(() => {
    const el = document.getElementById('skyv-loading-overlay');
    if (el) el.remove();
  })();`;
  try {
    sp.browser.executeJavaScript(js);
  } catch {
  }
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
  equipRagsWithRetries('menuOpen:' + e.name);
  const token = overlayToken;
  Utility.wait(2.0).then(() => {
    if (token !== overlayToken) return;
    hideOverlay();
  });
});

on('menuClose', (e) => {
  if (!RACE_MENU_NAMES.has(e.name)) return;
  raceMenuOpen = false;
  overlayToken++;
  showOverlay();
  equipRagsWithRetries('menuClose:' + e.name);
  const token = overlayToken;
  Utility.wait(1.0).then(() => {
    if (token !== overlayToken) return;
    hideOverlay();
  });
});

on('update', () => {
  if (!raceMenuOpen) return;

  const now = Date.now();
  if (now < nextTickAt) return;

  nextTickAt = now + 150;
  try {
    sp.browser.setVisible(true);
  } catch {
  }
});
