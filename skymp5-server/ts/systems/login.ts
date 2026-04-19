import { System, Log, Content, SystemContext } from "./system";
import { Settings } from "../settings";
import * as fetchRetry from "fetch-retry";
import { loginsCounter, loginErrorsCounter } from "./metricsSystem";
import { JoinTicketClaims, JoinTicketVerifier } from "../utils/joinTicket";
import * as fs from "fs";
import axios from "axios";

const loginFailedNotInTheDiscordServer = JSON.stringify({ customPacketType: "loginFailedNotInTheDiscordServer" });
const loginFailedBanned = JSON.stringify({ customPacketType: "loginFailedBanned" });
const loginFailedIpMismatch = JSON.stringify({ customPacketType: "loginFailedIpMismatch" });
const loginFailedSessionNotFound = JSON.stringify({ customPacketType: "loginFailedSessionNotFound" });
const loginFailedInvalidTicket = JSON.stringify({ customPacketType: "loginFailedInvalidTicket" });
const loginFailedTicketExpired = JSON.stringify({ customPacketType: "loginFailedTicketExpired" });
const loginFailedNotWhitelisted = JSON.stringify({ customPacketType: "loginFailedNotWhitelisted" });

type Mp = any; // TODO

interface UserProfile {
  id: number;
  discordId: string | null;
}

namespace DiscordErrors {
  export const unknownMember = 10007;
}

// See also NetworkingCombined.h
// In NetworkingCombined.h, we implement a hack to prevent the soul-transmission bug
// TODO: reimplement Login system. Preferably, in C++ with clear data flow.
export class Login implements System {
  systemName = "Login";

  constructor(
    private log: Log,
    private maxPlayers: number,
    private masterUrl: string | null,
    private serverPort: number,
    private masterKey: string,
    private offlineMode: boolean
  ) { }

  private getFetchOptions(callerFunctionName: string) {
    return {
      // retry on any network error, or 5xx status codes
      retryOn: (attempt: number, error: Error | null, response: Response) => {
        const retry = error !== null || response.status >= 500;
        if (retry) {
          console.log(`${callerFunctionName}: retrying request ${JSON.stringify({ attempt, error, status: response.status })}`);
        }
        return retry;
      },
      retries: 10
    };
  }

  private async getUserProfile(session: string, userId: number, ctx: SystemContext): Promise<UserProfile> {
    const response = await this.fetchRetry(
      `${this.masterUrl}/api/servers/${this.masterKey}/sessions/${session}`,
      this.getFetchOptions('getUserProfile')
    );

    if (!response.ok) {
      if (response.status === 404) {
        ctx.svr.sendCustomPacket(userId, loginFailedSessionNotFound);
      }
      throw new Error(`getUserProfile: HTTP error ${response.status}`);
    }

    const data = await response.json();

    if (!data || !data.user || !data.user.id) {
      throw new Error(`getUserProfile: bad master-api response ${JSON.stringify(data)}`);
    }

    return data.user as UserProfile;
  }

  async initAsync(ctx: SystemContext): Promise<void> {
    this.settingsObject = await Settings.get();
    this.joinTicketVerifier = JoinTicketVerifier.fromEnvOrDefaultFile();
    this.identityUrl = process.env.SKYV_IDENTITY_URL ?? "http://127.0.0.1:35800";

    this.log(
      `Login system assumed that ${this.masterKey} is our master api key`
    );
  }

  disconnect(userId: number): void {
  }

  customPacket(
    userId: number,
    type: string,
    content: Content,
    ctx: SystemContext,
  ): void {
    if (type === "skyvCharactersListRequest") {
      const gameData = content["gameData"];
      const session = gameData?.session;
      if (typeof session !== "string" || session.length < 20) return;
      (async () => {
        const nowSeconds = Math.floor(Date.now() / 1000);
        let claims: JoinTicketClaims;
        try {
          claims = this.joinTicketVerifier!.verify(session, nowSeconds);
        } catch {
          ctx.svr.sendCustomPacket(userId, loginFailedInvalidTicket);
          return;
        }
        if (!claims.whitelisted) {
          ctx.svr.sendCustomPacket(userId, loginFailedNotWhitelisted);
          return;
        }

        const acc = await this.resolveAccount(claims.sub, claims.slots);
        const payload = JSON.stringify({
          customPacketType: "skyvCharactersList",
          profileId: acc.profile_id,
          maxSlots: acc.slots,
          slots: (acc.characters ?? []).map((c: any, idx: number) => ({
            slotIndex: (typeof c.slot === "number" ? c.slot - 1 : idx),
            characterId: c.character_id ?? null,
            name: c.name ?? null,
            createdAtUtc: typeof c.created_at === "number" ? new Date(c.created_at).toISOString() : null,
            lastPlayedAtUtc: typeof c.last_played_at === "number" ? new Date(c.last_played_at).toISOString() : null,
          })),
        });
        ctx.svr.sendCustomPacket(userId, payload);
      })().catch((e) => {
        console.error("skyvCharactersListRequest failed:", e);
      });
      return;
    }

    if (type !== "loginWithSkympIo") return;

    const ip = ctx.svr.getUserIp(userId);
    console.log(`Connecting a user ${userId} with ip ${ip}`);

    let discordAuth = this.settingsObject.discordAuth;

    const gameData = content["gameData"];
    if (this.offlineMode === true && gameData && gameData.session) {
      this.log("The server is in offline mode, the client is NOT");
    } else if (this.offlineMode === false && gameData && gameData.session) {
      (async () => {
        this.emit(ctx, "userAssignSession", userId, gameData.session);

        const guidBeforeAsyncOp = ctx.svr.getUserGuid(userId);
        const profile = await this.getUserProfileOrTicket(gameData.session, userId, ctx);
        const guidAfterAsyncOp = ctx.svr.isConnected(userId) ? ctx.svr.getUserGuid(userId) : "<disconnected>";

        console.log({ guidBeforeAsyncOp, guidAfterAsyncOp, op: "getUserProfile" });

        if (guidBeforeAsyncOp !== guidAfterAsyncOp) {
          console.error(`User ${userId} changed guid from ${guidBeforeAsyncOp} to ${guidAfterAsyncOp} during async getUserProfile`);
          throw new Error("Guid mismatch after getUserProfile");
        }

        console.log("getUserProfileId:", profile);

        let skyvCharacterId: string | null = null;
        let skyvSlots: number | null = null;
        if (profile.__skyvJoinTicket === true) {
          skyvSlots = profile.__skyvSlots ?? 1;
          const acc = await this.resolveAccount(profile.discordId!, profile.__skyvSlots ?? 1);

          const reqCharacterId = gameData.characterId;
          const reqSlotIndex = gameData.slotIndex;

          let slotNum: number | null = null;

          if (typeof reqCharacterId === "string" && reqCharacterId.length >= 3) {
            const match = (acc.characters ?? []).find((c: any) => c.character_id === reqCharacterId);
            if (!match || typeof match.slot !== "number") {
              ctx.svr.sendCustomPacket(userId, loginFailedInvalidTicket);
              throw new Error("Invalid characterId");
            }
            skyvCharacterId = reqCharacterId;
            slotNum = Math.floor(match.slot);
          } else if (typeof reqSlotIndex === "number" && Number.isFinite(reqSlotIndex)) {
            const slotIndexNum = Math.floor(reqSlotIndex);
            if (slotIndexNum < 0 || slotIndexNum >= (profile.__skyvSlots ?? 1)) {
              ctx.svr.sendCustomPacket(userId, loginFailedInvalidTicket);
              throw new Error("Invalid slotIndex");
            }
            const existing = (acc.characters ?? []).find((c: any) => typeof c.slot === "number" && Math.floor(c.slot) === (slotIndexNum + 1));
            if (existing && typeof existing.character_id === "string" && existing.character_id.length >= 3) {
              skyvCharacterId = existing.character_id;
            } else {
              const created = await this.createCharacter(profile.discordId!, profile.__skyvSlots ?? 1, slotIndexNum, "");
              skyvCharacterId = created.character_id;
            }
            slotNum = slotIndexNum + 1;
          } else {
            ctx.svr.sendCustomPacket(userId, loginFailedInvalidTicket);
            throw new Error("Missing character selection");
          }

          profile.id = this.computeCharacterProfileId(acc.profile_id, slotNum!);
          this.touchCharacter(profile.discordId!, profile.__skyvSlots ?? 1, skyvCharacterId!).catch(() => { });
        }

        if (discordAuth && !discordAuth.botToken) {
          discordAuth = undefined;
          console.error("discordAuth.botToken is missing, skipping Discord server integration");
        }
        if (discordAuth && !discordAuth.guildId) {
          discordAuth = undefined;
          console.error("discordAuth.guildId is missing, skipping Discord server integration");
        }

        let roles = new Array<string>();

        if (profile.__skyvJoinTicket === true) {
          roles = [];
        } else if (discordAuth && profile.discordId) {
          const guidBeforeAsyncOp = ctx.svr.getUserGuid(userId);
          const response = await this.fetchRetry(
            `https://discord.com/api/guilds/${discordAuth.guildId}/members/${profile.discordId}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `${discordAuth.botToken}`,
              },
              ... this.getFetchOptions('discordAuth1'),
            },
          );
          const responseData = response.ok ? await response.json() : null;
          const guidAfterAsyncOp = ctx.svr.isConnected(userId) ? ctx.svr.getUserGuid(userId) : "<disconnected>";

          console.log({ guidBeforeAsyncOp, guidAfterAsyncOp, op: "Discord request" });

          if (guidBeforeAsyncOp !== guidAfterAsyncOp) {
            console.error(`User ${userId} changed guid from ${guidBeforeAsyncOp} to ${guidAfterAsyncOp} during async Discord request`);
            throw new Error("Guid mismatch after Discord request");
          }

          const mp = ctx.svr as unknown as Mp;

          // TODO: what if more characters
          const actorId = ctx.svr.getActorsByProfileId(profile.id)[0];

          const receivedRoles: string[] | null = (responseData && Array.isArray(responseData.roles)) ? responseData.roles : null;
          const currentRoles: string[] | null = actorId ? mp.get(actorId, "private.discordRoles") : null;
          roles = receivedRoles || currentRoles || [];

          console.log('Discord request:', JSON.stringify({ status: response.status, data: responseData }));

          if (response.status === 404 && responseData?.code === DiscordErrors.unknownMember) {
            ctx.svr.sendCustomPacket(userId, loginFailedNotInTheDiscordServer);
            throw new Error("Not in the Discord server");
          }

          // TODO: enable logging instead of throw
          // Disabled this check to be able bypassing ratelimit
          // if (response.status !== 200) {
          //   throw new Error("Unexpected response status: " +
          //     JSON.stringify({ status: response.status, data: response.data }));
          // }

          // TODO: remove this legacy discord-based ban system
          if (roles.indexOf(discordAuth.banRoleId) !== -1) {
            ctx.svr.sendCustomPacket(userId, loginFailedBanned);
            throw new Error("Banned");
          }
        }

        if ((ctx.svr as any).onLoginAttempt) {
          const isContinue = (ctx.svr as any).onLoginAttempt(profile.id);
          if (!isContinue) {
            ctx.svr.sendCustomPacket(userId, loginFailedBanned);
            throw new Error("Banned by gamemode");
          }
        }

        if (discordAuth && profile.discordId) {
          if (ip !== ctx.svr.getUserIp(userId)) {
            // It's a quick and dirty way to check if it's the same user
            // During async http call the user could free userId and someone else could connect with the same userId
            ctx.svr.sendCustomPacket(userId, loginFailedIpMismatch);
            throw new Error("IP mismatch");
          }
        }

        if (discordAuth && discordAuth.eventLogChannelId) {
          let ipToPrint = ip;

          if (discordAuth && discordAuth.hideIpRoleId) {
            if (roles.indexOf(discordAuth.hideIpRoleId) !== -1) {
              ipToPrint = "hidden";
            }
          }

          const actorIds = ctx.svr.getActorsByProfileId(profile.id).map(actorId => actorId.toString(16));

          this.postServerLoginToDiscord(discordAuth.eventLogChannelId, discordAuth.botToken, {
            userId,
            ipToPrint,
            actorIds,
            profile,
          });
        }

        this.emit(ctx, "spawnAllowed", userId, profile.id, roles, profile.discordId, skyvCharacterId, skyvSlots);
        loginsCounter.inc();
        this.log("Logged as " + profile.id);
      })()
        .catch((err) => {
          loginErrorsCounter.inc({ reason: err?.message || "unknown" });
          console.error("Error logging in client:", JSON.stringify(gameData), err)
        });
    } else if (this.offlineMode === true && gameData && typeof gameData.profileId === "number") {
      const profileId = gameData.profileId;
      this.emit(ctx, "spawnAllowed", userId, profileId, [], undefined);
      loginsCounter.inc();
      this.log(userId + " logged as " + profileId);
    } else {
      this.log("No credentials found in gameData:", gameData);
    }
  }

  private async getUserProfileOrTicket(sessionOrTicket: string, userId: number, ctx: SystemContext): Promise<UserProfile & { __skyvJoinTicket?: true, __skyvSlots?: number }> {
    const isJwtLike = typeof sessionOrTicket === "string" && sessionOrTicket.split(".").length === 3;
    if (!isJwtLike) {
      return await this.getUserProfile(sessionOrTicket, userId, ctx);
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    let claims: JoinTicketClaims;
    try {
      claims = this.joinTicketVerifier!.verify(sessionOrTicket, nowSeconds);
    } catch (e: any) {
      const msg = (e && typeof e.message === "string") ? e.message : "invalid";
      if (msg.toLowerCase().includes("expired")) {
        ctx.svr.sendCustomPacket(userId, loginFailedTicketExpired);
      } else {
        ctx.svr.sendCustomPacket(userId, loginFailedInvalidTicket);
      }
      throw e;
    }

    if (this.isReplay(claims)) {
      ctx.svr.sendCustomPacket(userId, loginFailedInvalidTicket);
      throw new Error("Replay jti");
    }

    if (!claims.whitelisted) {
      ctx.svr.sendCustomPacket(userId, loginFailedNotWhitelisted);
      throw new Error("Not whitelisted");
    }

    this.markUsed(claims);

    const profileId = await this.resolveProfileId(claims.sub, claims.slots);
    return { id: profileId, discordId: claims.sub, __skyvJoinTicket: true, __skyvSlots: claims.slots };
  }

  private async resolveProfileId(discordId: string, slots: number) {
    try {
      const res = await axios.post(
        `${this.identityUrl}/v1/resolve`,
        { discord_id: discordId, slots },
        { timeout: 1500 },
      );
      const profileId = res?.data?.profile_id;
      if (typeof profileId === "number" && Number.isFinite(profileId) && profileId > 0) {
        return profileId;
      }
      throw new Error("Bad identity response");
    } catch (e) {
      this.log(`SkyV-Identity unavailable; falling back to local mapping (${(e as any)?.message ?? "error"})`);
      return this.getOrCreateLocalProfileId(discordId);
    }
  }

  private async resolveAccount(discordId: string, slots: number) {
    const res = await axios.post(
      `${this.identityUrl}/v1/characters/list`,
      { discord_id: discordId, slots },
      { timeout: 1500 },
    );
    return res.data as any;
  }

  private async createCharacter(discordId: string, slots: number, slotIndex: number, name: string) {
    const res = await axios.post(
      `${this.identityUrl}/v1/characters/create`,
      { discord_id: discordId, slots, slot_index: slotIndex, name },
      { timeout: 1500 },
    );
    return res.data as any;
  }

  private async touchCharacter(discordId: string, slots: number, characterId: string) {
    await axios.post(
      `${this.identityUrl}/v1/characters/touch`,
      { discord_id: discordId, slots, character_id: characterId },
      { timeout: 1500 },
    );
  }

  private computeCharacterProfileId(baseProfileId: number, slotNum: number) {
    const s = Math.max(1, Math.min(50, Math.floor(slotNum)));
    if (s === 1) return baseProfileId;
    return baseProfileId * 1000 + s;
  }

  private getOrCreateLocalProfileId(discordId: string) {
    const dataDir = this.settingsObject?.dataDir ?? "./data";
    const p = `${dataDir}/skyv-identity.json`;
    let state: any = { nextId: 1, map: {} };
    try {
      if (fs.existsSync(p)) {
        state = JSON.parse(fs.readFileSync(p, "utf8"));
      }
    } catch {
    }
    if (!state.map) state.map = {};
    if (typeof state.nextId !== "number") state.nextId = 1;

    const existing = state.map[discordId];
    if (typeof existing === "number") return existing;

    const id = state.nextId;
    state.nextId = id + 1;
    state.map[discordId] = id;
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(p, JSON.stringify(state, null, 2));
    } catch {
    }
    return id;
  }

  private isReplay(claims: JoinTicketClaims) {
    this.pruneReplayCache();
    const expMs = (claims.exp ?? 0) * 1000;
    const existing = this.usedJtis.get(claims.jti);
    if (existing && existing >= Date.now()) return true;
    if (expMs <= Date.now()) return true;
    return false;
  }

  private markUsed(claims: JoinTicketClaims) {
    const expMs = (claims.exp ?? 0) * 1000;
    this.usedJtis.set(claims.jti, expMs);
  }

  private pruneReplayCache() {
    const now = Date.now();
    if (now - this.lastReplayPruneAt < 10_000) return;
    this.lastReplayPruneAt = now;
    for (const [k, v] of this.usedJtis.entries()) {
      if (v <= now) this.usedJtis.delete(k);
    }
  }

  private joinTicketVerifier: JoinTicketVerifier | null = null;
  private usedJtis = new Map<string, number>();
  private lastReplayPruneAt = 0;
  private identityUrl: string = "http://127.0.0.1:35800";

  private postServerLoginToDiscord(eventLogChannelId: string, botToken: string, options: { userId: number, ipToPrint: string, actorIds: string[], profile: UserProfile }) {
    const { userId, ipToPrint, actorIds, profile } = options;

    const loginMessage = `Server Login: Server Slot ${userId}, IP ${ipToPrint}, Actor ID ${actorIds}, Master API ${profile.id}, Discord ID ${profile.discordId} <@${profile.discordId}>`;
    console.log(loginMessage);

    this.fetchRetry(`https://discord.com/api/channels/${eventLogChannelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: loginMessage,
        allowed_mentions: { parse: [] },
      }),
      ... this.getFetchOptions('discordAuth2'),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Error sending message to Discord: ${response.statusText}`);
      }
      return response.json();
    }).then((_data): null => {
      return null;
    }).catch((err) => {
      console.error("Error sending message to Discord:", err);
    });
  }

  private emit(ctx: SystemContext, eventName: string, ...args: unknown[]) {
    (ctx.gm as any).emit(eventName, ...args);
  }

  private settingsObject: Settings;
  private fetchRetry = fetchRetry.default(global.fetch);
}
