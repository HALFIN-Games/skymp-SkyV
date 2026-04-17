import { System, Log, Content, SystemContext } from "./system";
import { Settings } from "../settings";
import * as fetchRetry from "fetch-retry";
import { loginsCounter, loginErrorsCounter } from "./metricsSystem";
import { JoinTicketClaims, JoinTicketVerifier } from "../utils/joinTicket";
import * as fs from "fs";

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
    if (type !== "loginWithSkympIo") {
      return;
    }

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

        this.emit(ctx, "spawnAllowed", userId, profile.id, roles, profile.discordId);
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

  private async getUserProfileOrTicket(sessionOrTicket: string, userId: number, ctx: SystemContext): Promise<UserProfile & { __skyvJoinTicket?: true }> {
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

    const profileId = this.getOrCreateLocalProfileId(claims.sub);
    return { id: profileId, discordId: claims.sub, __skyvJoinTicket: true };
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
