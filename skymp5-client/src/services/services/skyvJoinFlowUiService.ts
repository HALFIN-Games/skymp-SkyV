import { BrowserMessageEvent, Menu, MenuCloseEvent, MenuOpenEvent, storage } from "skyrimPlatform";
import { ClientListener, CombinedController, Sp } from "./clientListener";
import { logTrace } from "../../logging";
import { authGameDataStorageKey } from "../../features/authModel";

const events = {
  ackRules: 'skyvJoin_ackRules',
  showCharacters: 'skyvJoin_showCharacters',
  selectCharacter: 'skyvJoin_selectCharacter',
  createCharacter: 'skyvJoin_createCharacter',
  cancelQueue: 'skyvJoin_cancelQueue',
  closeUi: 'skyvJoin_closeUi',
} as const;

const joinTicketEventKey = "skyvJoin_ticket";

type Screen = 'rules' | 'characters' | 'queue';

type JoinState = {
  hasAcknowledgedRules: boolean;
  selectedCharacterId: string | null;
  screen: Screen;
};

export class SkyvJoinFlowUiService extends ClientListener {
  constructor(private sp: Sp, private controller: CombinedController) {
    super();

    this.controller.on("menuOpen", (e) => this.onMenuOpen(e));
    this.controller.on("menuClose", (e) => this.onMenuClose(e));
    this.controller.on("browserMessage", (e) => this.onBrowserMessage(e));

    this.state = this.readState();
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
      this.controller.emitter.emit("skyvJoinConnect", { characterId: this.state.selectedCharacterId });
      return;
    }

    if (key === events.ackRules) {
      this.state.hasAcknowledgedRules = true;
      this.state.screen = 'characters';
      this.writeState(this.state);
      this.render();
      return;
    }

    if (key === events.showCharacters) {
      this.state.screen = 'characters';
      this.state.selectedCharacterId = null;
      this.writeState(this.state);
      this.render();
      return;
    }

    if (key === events.selectCharacter) {
      const characterId = e.arguments?.[1];
      this.state.selectedCharacterId = typeof characterId === 'string' ? characterId : null;
      this.state.screen = 'queue';
      this.writeState(this.state);
      this.render();
      this.openWebsiteJoin();
      return;
    }

    if (key === events.createCharacter) {
      this.state.selectedCharacterId = null;
      this.state.screen = 'queue';
      this.writeState(this.state);
      this.render();
      this.openWebsiteJoin();
      return;
    }

    if (key === events.cancelQueue) {
      this.controller.emitter.emit("skyvJoinCancel", {});
      this.state.screen = 'characters';
      this.state.selectedCharacterId = null;
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

    if (!this.state.hasAcknowledgedRules) {
      this.state.screen = 'rules';
    } else if (this.state.screen !== 'queue') {
      this.state.screen = 'characters';
    }
    this.writeState(this.state);
    this.render();
  }

  private openWebsiteJoin() {
    try {
      this.sp.browser.loadUrl("https://vokunrp.com/game/join");
      this.sp.browser.setVisible(true);
      this.sp.browser.setFocused(true);
    } catch {
    }
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
      maxSlots: 5,
      serverName: 'Vokun Roleplay',
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
      title.style.cssText = 'font-size:26px;font-weight:700;letter-spacing:0.4px;';

      const subtitle = document.createElement('div');
      subtitle.textContent = model.screen === 'rules' ? 'Rules acknowledgement' : model.screen === 'queue' ? 'Queue' : 'Character selection';
      subtitle.style.cssText = 'font-size:13px;color:' + theme.muted + ';margin-top:4px;';

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
        el.style.cssText = 'color:' + theme.muted + ';font-size:14px;line-height:1.45;margin-top:6px;';
        return el;
      };

      if (model.screen === 'rules') {
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
        box.appendChild(p('You must acknowledge the server rules once before creating your first character.'));
        box.appendChild(p('Full rules content will be linked/embedded here.'));
        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:10px;margin-top:14px;';
        actions.appendChild(btn('I agree', () => send(${JSON.stringify(events.ackRules)})));
        box.appendChild(actions);
        body.appendChild(box);
      }

      if (model.screen === 'characters') {
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
        box.appendChild(p('Choose a character to join. Clicking create/select will enqueue you (queue stub for now).'));

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(5, 1fr);gap:10px;margin-top:12px;';
        for (let i = 1; i <= model.maxSlots; i++) {
          const card = document.createElement('div');
          card.style.cssText = 'border:1px solid ' + theme.border + ';border-radius:12px;padding:10px;min-height:92px;display:flex;flex-direction:column;justify-content:space-between;';
          const label = document.createElement('div');
          label.textContent = 'Slot ' + i;
          label.style.cssText = 'font-size:13px;color:' + theme.muted + ';';
          const action = btn('Select', () => send(${JSON.stringify(events.selectCharacter)}, 'slot-' + i));
          action.style.padding = '10px 12px';
          card.appendChild(label);
          card.appendChild(action);
          grid.appendChild(card);
        }
        box.appendChild(grid);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:10px;margin-top:14px;';
        actions.appendChild(btn('Create character', () => send(${JSON.stringify(events.createCharacter)})));
        body.appendChild(box);
        body.appendChild(actions);
      }

      if (model.screen === 'queue') {
        const box = document.createElement('div');
        box.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
        box.appendChild(p('Joining queue...'));
        box.appendChild(p('Queue is not implemented yet. This is a UI/flow stub.'));

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
      return { hasAcknowledgedRules: false, selectedCharacterId: null, screen: 'rules' };
    }
    try {
      const parsed = JSON.parse(raw) as Partial<JoinState>;
      return {
        hasAcknowledgedRules: Boolean(parsed.hasAcknowledgedRules),
        selectedCharacterId: typeof parsed.selectedCharacterId === 'string' ? parsed.selectedCharacterId : null,
        screen: parsed.screen === 'characters' || parsed.screen === 'queue' || parsed.screen === 'rules' ? parsed.screen : 'rules',
      };
    } catch {
      return { hasAcknowledgedRules: false, selectedCharacterId: null, screen: 'rules' };
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
