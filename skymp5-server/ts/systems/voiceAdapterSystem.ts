import axios from "axios";
import { Log, System, SystemContext } from "./system";

type EvaluatePlayer = {
  user_id: number;
  discord_id: string;
  worldspace: number;
  cell: number;
  pos: { x: number; y: number; z: number };
  voice_mode: "normal";
  ptt: false;
};

export class VoiceAdapterSystem implements System {
  systemName = "VoiceAdapterSystem";

  constructor(private log: Log) {}

  connect(userId: number): void {
    this.connectedUserIds.add(userId);
  }

  disconnect(userId: number): void {
    this.connectedUserIds.delete(userId);
  }

  async updateAsync(ctx: SystemContext): Promise<void> {
    const now = Date.now();
    if (now - this.lastEvalAt < this.evalIntervalMs) return;
    this.lastEvalAt = now;

    const players: EvaluatePlayer[] = [];
    for (const userId of this.connectedUserIds) {
      try {
        if (!ctx.svr.isConnected(userId)) continue;
        const actorId = ctx.svr.getUserActor(userId);
        if (!actorId) continue;
        const pos = ctx.svr.getActorPos(actorId);
        if (!Array.isArray(pos) || pos.length < 3) continue;
        const cellOrWorld = ctx.svr.getActorCellOrWorld(actorId);
        players.push({
          user_id: userId,
          discord_id: String(ctx.svr.getUserGuid(userId) ?? ""),
          worldspace: Number(cellOrWorld) || 0,
          cell: Number(cellOrWorld) || 0,
          pos: { x: Number(pos[0]) || 0, y: Number(pos[1]) || 0, z: Number(pos[2]) || 0 },
          voice_mode: "normal",
          ptt: false,
        });
      } catch {
        // Best-effort adapter: skip invalid users without affecting gameplay.
      }
    }

    try {
      const headers: Record<string, string> = {};
      if (this.evalKey) headers["x-voip-key"] = this.evalKey;
      const response = await axios.post(
        `${this.voiceUrl}/v1/evaluate`,
        {
          server_id: this.serverId,
          now_unix_ms: now,
          players,
        },
        {
          headers,
          timeout: 1000,
        },
      );
      const audibleCount = Array.isArray(response.data?.audible) ? response.data.audible.length : 0;
      this.log(`[voice-adapter] evaluate ok players=${players.length} audible=${audibleCount}`);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.message ?? "error";
      if (now - this.lastFailLogAt >= this.failLogIntervalMs) {
        this.lastFailLogAt = now;
        this.log(`[voice-adapter] evaluate failed status=${status ?? "n/a"} msg=${msg}`);
      }
    }
  }

  private connectedUserIds = new Set<number>();
  private lastEvalAt = 0;
  private evalIntervalMs = Math.max(100, Number(process.env.VOICE_EVAL_INTERVAL_MS ?? "5000") || 5000);
  private lastFailLogAt = 0;
  private failLogIntervalMs = Math.max(1000, Number(process.env.VOICE_EVAL_FAIL_LOG_INTERVAL_MS ?? "30000") || 30000);
  private voiceUrl = (process.env.SKYV_VOIP_URL ?? "http://127.0.0.1:35810").replace(/\/+$/, "");
  private evalKey = (process.env.SKYV_VOIP_EVAL_KEY ?? "").trim();
  private serverId = process.env.SKYV_SERVER_ID ?? "vokun-main";
}
