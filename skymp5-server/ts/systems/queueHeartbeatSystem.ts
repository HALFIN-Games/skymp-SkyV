import Axios from "axios";
import { ScampServer } from "../scampNative";
import { Log, System, SystemContext } from "./system";

export class QueueHeartbeatSystem implements System {
  systemName = "QueueHeartbeatSystem";

  constructor(
    private log: Log,
    private maxPlayers: number,
    private updateIntervalMs = 2000,
  ) { }

  async initAsync(): Promise<void> {
    this.queueUrl = process.env.SKYV_QUEUE_URL ?? "";
    this.serverId = process.env.SKYV_QUEUE_SERVER_ID ?? "vokun-main";
    this.reservedSlots = parseInt(process.env.SKYV_RESERVED_SLOTS ?? "0", 10);

    if (!this.queueUrl) {
      this.log("Queue heartbeat disabled (SKYV_QUEUE_URL is not set)");
      return;
    }

    this.endpoint = `${this.queueUrl.replace(/\/+$/, "")}/v1/server/state`;
    this.log(`Queue heartbeat endpoint: ${this.endpoint} (server_id=${this.serverId})`);
  }

  async updateAsync(ctx: SystemContext): Promise<void> {
    await new Promise((r) => setTimeout(r, this.updateIntervalMs));
    if (!this.endpoint) return;

    const connectedPlayers = this.getCurrentOnline(ctx.svr);
    try {
      await Axios.post(this.endpoint, {
        server_id: this.serverId,
        max_players: this.maxPlayers,
        reserved_slots: Math.max(0, this.reservedSlots || 0),
        connected_players: connectedPlayers,
      });
    } catch (e) {
      console.error(`Error updating info on queue service: ${e}`);
    }
  }

  private getCurrentOnline(svr: ScampServer): number {
    return (svr as any).get(0, "onlinePlayers").length;
  }

  private endpoint: string;
  private queueUrl: string;
  private serverId: string;
  private reservedSlots: number;
}

