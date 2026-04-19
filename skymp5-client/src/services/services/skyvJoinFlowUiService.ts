import { BrowserMessageEvent, Menu, MenuCloseEvent, MenuOpenEvent, storage } from "skyrimPlatform";
import { ClientListener, CombinedController, Sp } from "./clientListener";
import { logTrace } from "../../logging";
import { authGameDataStorageKey } from "../../features/authModel";
import { ConnectionDenied } from "../events/connectionDenied";
import { ConnectionFailed } from "../events/connectionFailed";
import { ConnectionMessage } from "../events/connectionMessage";
import { CustomPacketMessage } from "../messages/customPacketMessage";

const events = {
  showCharacters: 'skyvJoin_showCharacters',
  selectCharacter: 'skyvJoin_selectCharacter',
  createCharacter: 'skyvJoin_createCharacter',
  cancelQueue: 'skyvJoin_cancelQueue',
  closeUi: 'skyvJoin_closeUi',
} as const;

const joinTicketEventKey = "skyvJoin_ticket";
const diskJoinTicketPluginName = "skyv-join-ticket-no-load";

type Screen = 'characters' | 'queue';

type SlotView = {
  slotIndex: number;
  characterId: string | null;
  name: string | null;
};

type JoinState = {
  hasAcknowledgedRules: boolean;
  selectedCharacterId: string | null;
  screen: Screen;
  maxSlots: number;
  slots: SlotView[];
  error: string | null;
};

export class SkyvJoinFlowUiService extends ClientListener {
  constructor(private sp: Sp, private controller: CombinedController) {
    super();

    this.controller.on("menuOpen", (e) => this.onMenuOpen(e));
    this.controller.on("menuClose", (e) => this.onMenuClose(e));
    this.controller.on("browserMessage", (e) => this.onBrowserMessage(e));
    this.controller.emitter.on("customPacketMessage", (e) => this.onCustomPacketMessage(e));
    this.controller.emitter.on("connectionDenied", (e) => this.onConnectionDenied(e));
    this.controller.emitter.on("connectionFailed", (e) => this.onConnectionFailed(e));
    this.controller.once("tick", () => this.bootstrapOnFirstTick());
    this.controller.once("tick", () => this.tryApplyJoinTicketFromDisk());

    this.state = this.readState();
  }

  private tryApplyJoinTicketFromDisk() {
    try {
      const raw = (this.sp as any).getPluginSourceCode(diskJoinTicketPluginName, "PluginsNoLoad") as string | undefined;
      if (!raw) return;
      const json = raw.startsWith("//") ? raw.slice(2) : raw;
      const obj = JSON.parse(json) as any;
      const ticket = obj?.ticket ?? obj?.Ticket;
      if (typeof ticket !== "string" || ticket.length < 20) return;

      this.storeJoinTicket(ticket);
      const decoded = this.tryDecodeSlotsFromTicket(ticket);
      if (typeof decoded === "number") {
        this.state.maxSlots = decoded;
      }
      this.state.screen = 'characters';
      this.writeState(this.state);
      if (this.isEnabled() && this.mainMenuOpen) {
        this.open();
      } else {
        this.render();
      }
    } catch {
    } finally {
      try {
        (this.sp as any).writePlugin(diskJoinTicketPluginName, "//null", "PluginsNoLoad");
      } catch {
      }
    }
  }

  private bootstrapOnFirstTick() {
    if (!this.isEnabled()) return;
    if (this.mainMenuOpen) return;
    this.mainMenuOpen = true;
    this.open();
  }

  private onMenuOpen(e: MenuOpenEvent) {
    if (e.name !== Menu.Main) return;
    if (!this.isEnabled()) return;

    this.mainMenuOpen = true;
    this.open();
  }

  private onMenuClose(e: MenuCloseEvent) {
    if (e.name !== Menu.Main) return;
    this.mainMenuOpen = false;
    this.close();
  }

  private onBrowserMessage(e: BrowserMessageEvent) {
    if (!this.listening) return;

    const key = e.arguments?.[0];
    if (typeof key !== 'string') return;

    if (key === joinTicketEventKey) {
      const ticket = e.arguments?.[1];
      if (typeof ticket !== "string" || ticket.length < 20) return;
      this.storeJoinTicket(ticket);
      const decoded = this.tryDecodeSlotsFromTicket(ticket);
      if (typeof decoded === "number") {
        this.state.maxSlots = decoded;
      }
      this.state.screen = 'characters';
      this.state.error = null;
      this.writeState(this.state);
      this.render();
      return;
    }

    if (key === events.showCharacters) {
      this.state.screen = 'characters';
      this.state.selectedCharacterId = null;
      this.state.error = null;
      this.writeState(this.state);
      this.render();
      return;
    }

    if (key === events.selectCharacter) {
      const characterId = e.arguments?.[1];
      this.state.selectedCharacterId = typeof characterId === 'string' ? characterId : null;
      if (!this.hasJoinTicket()) {
        this.state.screen = 'characters';
        this.state.error = null;
        this.writeState(this.state);
        this.render();
      } else {
        this.state.screen = 'queue';
        this.state.error = null;
        this.writeState(this.state);
        this.render();
        this.controller.emitter.emit("skyvJoinConnect", { characterId: this.state.selectedCharacterId });
      }
      return;
    }

    if (key === events.createCharacter) {
      const payload = e.arguments?.[1] as any;
      const slotIndex = typeof payload?.slotIndex === "number" ? Math.floor(payload.slotIndex) : -1;
      const name = typeof payload?.name === "string" ? payload.name : "";

      if (!this.hasJoinTicket()) {
        this.state.screen = 'characters';
        this.state.error = null;
        this.writeState(this.state);
        this.render();
        return;
      }

      if (slotIndex < 0 || slotIndex >= this.state.maxSlots) {
        this.state.screen = 'characters';
        this.state.error = "Invalid slot.";
        this.writeState(this.state);
        this.render();
        return;
      }

      const cleaned = name.trim();
      if (cleaned.length < 1 || cleaned.length > 50) {
        this.state.screen = 'characters';
        this.state.error = "Name must be 1–50 characters.";
        this.writeState(this.state);
        this.render();
        return;
      }

      this.state.selectedCharacterId = null;
      if (!this.hasJoinTicket()) {
        this.state.screen = 'characters';
        this.state.error = null;
        this.writeState(this.state);
        this.render();
      } else {
        this.state.screen = 'queue';
        this.state.error = null;
        this.writeState(this.state);
        this.render();
        this.controller.emitter.emit("skyvJoinCreateCharacter", { slotIndex, name: cleaned });
      }
      return;
    }

    if (key === events.cancelQueue) {
      this.controller.emitter.emit("skyvJoinCancel", {});
      this.state.screen = 'characters';
      this.state.selectedCharacterId = null;
      this.state.error = null;
      this.writeState(this.state);
      this.render();
      return;
    }

    if (key === events.closeUi) {
      this.close();
      return;
    }
  }

  private open() {
    this.listening = true;
    this.sp.browser.setVisible(true);
    this.sp.browser.setFocused(true);

    if (this.state.screen !== 'queue') {
      this.state.screen = 'characters';
    }

    if (this.hasJoinTicket()) {
      const gd = this.sp.storage[authGameDataStorageKey] as any;
      const ticket = gd?.remote?.session;
      if (typeof ticket === "string") {
        const decoded = this.tryDecodeSlotsFromTicket(ticket);
        if (typeof decoded === "number") {
          this.state.maxSlots = decoded;
        }
      }
      storage["skyvJoinAllowConnect"] = "true";
    }

    this.writeState(this.state);
    this.render();
  }

  private storeJoinTicket(ticket: string) {
    this.sp.storage[authGameDataStorageKey] = {
      remote: {
        session: ticket,
        masterApiId: 0,
        discordUsername: null,
        discordDiscriminator: null,
        discordAvatar: null,
      }
    };
  }

  private onConnectionDenied(e: ConnectionDenied) {
    if (!this.listening) return;
    this.state.screen = 'queue';
    this.state.error = e.error || "Connection denied.";
    this.writeState(this.state);
    this.render();
  }

  private onConnectionFailed(_e: ConnectionFailed) {
    if (!this.listening) return;
    this.state.screen = 'queue';
    this.state.error = "Connection failed.";
    this.writeState(this.state);
    this.render();
  }

  private onCustomPacketMessage(event: ConnectionMessage<CustomPacketMessage>) {
    if (!this.listening) return;
    let msgContent: any;
    try {
      msgContent = JSON.parse(event.message.contentJsonDump);
    } catch {
      return;
    }
    const t = msgContent?.customPacketType;
    if (t === "skyvCharactersList") {
      const maxSlots = msgContent?.maxSlots;
      const slots = Array.isArray(msgContent?.slots) ? msgContent.slots : [];
      if (typeof maxSlots === "number" && Number.isFinite(maxSlots)) {
        this.state.maxSlots = Math.max(1, Math.min(50, Math.floor(maxSlots)));
      }
      const out: SlotView[] = [];
      for (let i = 0; i < this.state.maxSlots; i++) {
        const src = slots.find((s: any) => s && typeof s.slotIndex === "number" && Math.floor(s.slotIndex) === i) ?? null;
        out.push({
          slotIndex: i,
          characterId: src && typeof src.characterId === "string" ? src.characterId : null,
          name: src && typeof src.name === "string" ? src.name : null,
        });
      }
      this.state.slots = out;
      this.writeState(this.state);
      this.render();
      return;
    }

    if (t === "skyvCreateCharacterError") {
      const err = msgContent?.error;
      this.state.screen = 'characters';
      this.state.error = typeof err === "string" ? err : "Failed to create character.";
      this.writeState(this.state);
      this.render();
      return;
    }
  }

  private hasJoinTicket() {
    const gd = this.sp.storage[authGameDataStorageKey] as any;
    const session = gd?.remote?.session;
    return typeof session === "string" && session.split(".").length === 3 && session.length > 20;
  }

  private hideBrowser() {
    try {
      this.sp.browser.setFocused(false);
      this.sp.browser.setVisible(false);
    } catch {
    }
  }

  private tryDecodeSlotsFromTicket(ticket: string) {
    try {
      const parts = ticket.split(".");
      if (parts.length !== 3) return null;
      const payload = parts[1];
      const pad = payload.length % 4 === 0 ? "" : "=".repeat(4 - (payload.length % 4));
      const b64 = (payload + pad).replace(/-/g, "+").replace(/_/g, "/");
      const json = Buffer.from(b64, "base64").toString("utf8");
      const obj = JSON.parse(json) as any;
      const slots = obj?.slots;
      if (typeof slots === "number" && Number.isFinite(slots) && slots >= 1 && slots <= 50) return Math.floor(slots);
      return null;
    } catch {
      return null;
    }
  }

  private close() {
    this.listening = false;
    try {
      this.sp.browser.executeJavaScript(this.removeUiJs());
    } catch {
    }
    this.sp.browser.setFocused(false);
    this.sp.browser.setVisible(false);
  }

  private render() {
    if (!this.mainMenuOpen) return;

    const js = this.renderJs(this.state);
    this.sp.browser.executeJavaScript(js);
  }

  private renderJs(state: JoinState) {
    const theme = {
      main: '#0C2D24',
      text: '#E7F3EF',
      muted: '#9FC1B7',
      border: 'rgba(231,243,239,0.18)',
      panel: 'rgba(12,45,36,0.92)',
      button: '#0C2D24',
      buttonHover: '#0A241D',
      buttonText: '#E7F3EF',
      danger: '#7A1E1E',
    };

    const model = {
      ...state,
      maxSlots: state.maxSlots,
      serverName: 'Vokun Roleplay',
      isAuthed: this.hasJoinTicket(),
    };

    return `(() => {
      const theme = ${JSON.stringify(theme)};
      const model = ${JSON.stringify(model)};
      const send = (k, v) => {
        try { window.skyrimPlatform.sendMessage(k, v); } catch (e) {}
      };

      const id = 'skyv-join-ui';
      let root = document.getElementById(id);
      if (!root) {
        root = document.createElement('div');
        root.id = id;
        document.body.appendChild(root);
      }

      root.innerHTML = '';
      root.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:2147483647',
        'display:flex',
        'align-items:center',
        'justify-content:center',
        'background:rgba(0,0,0,0.65)',
        'color:' + theme.text,
        'font-family:Segoe UI, Arial, sans-serif'
      ].join(';');

      const panel = document.createElement('div');
      panel.style.cssText = [
        'width:860px',
        'max-width:calc(100vw - 80px)',
        'border:1px solid ' + theme.border,
        'background:' + theme.panel,
        'border-radius:14px',
        'padding:22px',
        'box-shadow:0 18px 60px rgba(0,0,0,0.6)'
      ].join(';');

      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px;';

      const titleWrap = document.createElement('div');
      const title = document.createElement('div');
      title.textContent = model.serverName;
      title.style.cssText = 'font-size:32px;font-weight:800;letter-spacing:0.4px;';

      const subtitle = document.createElement('div');
      subtitle.textContent = model.screen === 'queue' ? 'Connecting' : 'Character selection';
      subtitle.style.cssText = 'font-size:16px;font-weight:700;color:' + theme.muted + ';margin-top:6px;';

      titleWrap.appendChild(title);
      titleWrap.appendChild(subtitle);

      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Close';
      closeBtn.style.cssText = [
        'background:transparent',
        'border:1px solid ' + theme.border,
        'color:' + theme.text,
        'border-radius:10px',
        'padding:8px 12px',
        'cursor:pointer'
      ].join(';');
      closeBtn.onclick = () => send(${JSON.stringify(events.closeUi)});

      header.appendChild(titleWrap);
      header.appendChild(closeBtn);

      const body = document.createElement('div');
      body.style.cssText = 'margin-top:10px;';

      const btn = (text, onClick, variant) => {
        const b = document.createElement('button');
        b.textContent = text;
        b.style.cssText = [
          'background:' + (variant === 'danger' ? theme.danger : theme.button),
          'border:1px solid ' + theme.border,
          'color:' + theme.buttonText,
          'border-radius:12px',
          'padding:12px 14px',
          'cursor:pointer',
          'font-weight:600'
        ].join(';');
        b.onmouseenter = () => { if (variant !== 'danger') b.style.background = theme.buttonHover; };
        b.onmouseleave = () => { if (variant !== 'danger') b.style.background = theme.button; };
        b.onclick = onClick;
        return b;
      };

      const p = (text) => {
        const el = document.createElement('div');
        el.textContent = text;
        el.style.cssText = 'color:' + theme.muted + ';font-size:16px;font-weight:600;line-height:1.45;margin-top:6px;';
        return el;
      };

      if (model.screen === 'characters') {
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
        if (!model.isAuthed) {
          box.appendChild(p('No launcher join ticket detected.'));
          box.appendChild(p('Close Skyrim and click Join Server on the website so the launcher can pass a ticket.'));
          body.appendChild(box);
          panel.appendChild(header);
          panel.appendChild(body);
          root.appendChild(panel);
          return;
        }

        if (model.error) {
          const err = document.createElement('div');
          err.textContent = model.error;
          err.style.cssText = 'color:' + theme.text + ';background:rgba(122,30,30,0.35);border:1px solid ' + theme.border + ';border-radius:12px;padding:10px 12px;font-weight:700;';
          box.appendChild(err);
        }

        box.appendChild(p('Choose a character to join.'));

        const list = document.createElement('div');
        list.style.cssText = 'display:flex;flex-direction:column;gap:10px;margin-top:12px;';

        const slots = Array.isArray(model.slots) && model.slots.length ? model.slots : Array.from({ length: model.maxSlots }, (_, i) => ({ slotIndex: i, characterId: null, name: null }));

        for (let i = 0; i < model.maxSlots; i++) {
          const slot = slots.find(s => s && s.slotIndex === i) || { slotIndex: i, characterId: null, name: null };
          const card = document.createElement('div');
          card.style.cssText = 'border:1px solid ' + theme.border + ';border-radius:12px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;';
          const label = document.createElement('div');
          label.textContent = slot.name ? slot.name : ('Empty Slot ' + (i + 1));
          label.style.cssText = 'font-size:18px;font-weight:800;color:' + theme.text + ';';

          let action;
          if (slot.characterId) {
            action = btn('Play', () => send(${JSON.stringify(events.selectCharacter)}, slot.characterId));
          } else {
            action = btn('Create', () => {
              const n = window.prompt('Character name (1–50 chars):', '');
              if (!n) return;
              send(${JSON.stringify(events.createCharacter)}, { slotIndex: i, name: String(n) });
            });
          }
          card.appendChild(label);
          card.appendChild(action);
          list.appendChild(card);
        }
        box.appendChild(list);
        body.appendChild(box);
      }

      if (model.screen === 'queue') {
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
        box.appendChild(p('Connecting...'));
        box.appendChild(p('Please wait while we connect you to the server.'));

        if (model.error) {
          const err = document.createElement('div');
          err.textContent = model.error;
          err.style.cssText = 'color:' + theme.text + ';background:rgba(122,30,30,0.35);border:1px solid ' + theme.border + ';border-radius:12px;padding:10px 12px;font-weight:700;margin-top:8px;';
          box.appendChild(err);
        }

        const bar = document.createElement('div');
        bar.style.cssText = 'width:100%;height:10px;background:rgba(255,255,255,0.12);border-radius:999px;overflow:hidden;margin-top:10px;';
        const fill = document.createElement('div');
        fill.style.cssText = 'height:100%;width:35%;background:' + theme.text + ';border-radius:999px;animation:skyvJoinLoad 1.2s ease-in-out infinite;';
        const styleId = 'skyv-join-style';
        if (!document.getElementById(styleId)) {
          const st = document.createElement('style');
          st.id = styleId;
          st.textContent = '@keyframes skyvJoinLoad{0%{transform:translateX(-120%);}50%{transform:translateX(120%);}100%{transform:translateX(320%);}}';
          document.head.appendChild(st);
        }
        bar.appendChild(fill);
        box.appendChild(bar);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:10px;margin-top:14px;';
        actions.appendChild(btn('Back', () => send(${JSON.stringify(events.showCharacters)})));
        actions.appendChild(btn('Cancel', () => send(${JSON.stringify(events.cancelQueue)}), 'danger'));
        box.appendChild(actions);
        body.appendChild(box);
      }

      panel.appendChild(header);
      panel.appendChild(body);
      root.appendChild(panel);
    })();`;
  }

  private removeUiJs() {
    return `(() => {
      const el = document.getElementById('skyv-join-ui');
      if (el) el.remove();
    })();`;
  }

  private isEnabled() {
    const cfg = this.sp.settings["skymp5-client"]["skyv-join-ui"];
    if (typeof cfg === 'boolean') return cfg;
    return true;
  }

  private readState(): JoinState {
    const raw = storage[this.storageKey] as string | undefined;
    if (!raw) {
      return { hasAcknowledgedRules: true, selectedCharacterId: null, screen: 'characters', maxSlots: 5, slots: [], error: null };
    }
    try {
      const parsed = JSON.parse(raw) as Partial<JoinState>;
      return {
        hasAcknowledgedRules: Boolean(parsed.hasAcknowledgedRules),
        selectedCharacterId: typeof parsed.selectedCharacterId === 'string' ? parsed.selectedCharacterId : null,
        screen: parsed.screen === 'characters' || parsed.screen === 'queue' ? parsed.screen : 'characters',
        maxSlots: typeof parsed.maxSlots === 'number' && Number.isFinite(parsed.maxSlots) ? Math.max(1, Math.min(50, Math.floor(parsed.maxSlots))) : 5,
        slots: Array.isArray((parsed as any).slots) ? ((parsed as any).slots as any[]).map((s: any) => ({
          slotIndex: typeof s?.slotIndex === "number" ? Math.floor(s.slotIndex) : -1,
          characterId: typeof s?.characterId === "string" ? s.characterId : null,
          name: typeof s?.name === "string" ? s.name : null,
        })).filter((s: any) => typeof s.slotIndex === "number" && s.slotIndex >= 0 && s.slotIndex < 50) : [],
        error: typeof (parsed as any).error === "string" ? (parsed as any).error : null,
      };
    } catch {
      return { hasAcknowledgedRules: true, selectedCharacterId: null, screen: 'characters', maxSlots: 5, slots: [], error: null };
    }
  }

  private writeState(state: JoinState) {
    storage[this.storageKey] = JSON.stringify(state);
  }

  private storageKey = 'skyvJoinState';
  private state: JoinState;
  private mainMenuOpen = false;
  private listening = false;
}
