const { on, Utility, Game, Armor, writeLogs } = require('skyrimPlatform');

const RAGGED_ROBES = 0x00013105;
const RAGGED_BOOTS = 0x00013106;

const RACE_MENU_NAMES = new Set([
  'RaceSex Menu',
  'RaceMenu',
]);

let raceMenuOpen = false;
let nextTickAt = 0;

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

  unequipSlot(pl, 30);
  unequipSlot(pl, 32);
  unequipSlot(pl, 37);

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
  let remaining = 60;

  const tick = () => {
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
  equipRagsWithRetries('menuOpen:' + e.name);
});

on('menuClose', (e) => {
  if (!RACE_MENU_NAMES.has(e.name)) return;
  raceMenuOpen = false;
  equipRagsWithRetries('menuClose:' + e.name);
});

on('update', () => {
  if (!raceMenuOpen) return;

  const now = Date.now();
  if (now < nextTickAt) return;

  nextTickAt = now + 150;
  ensureAndEquipRags();
});
