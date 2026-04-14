import { Settings } from "../settings";
import { System, Log, SystemContext } from "./system";

type Mp = any; // TODO

const STARTER_KIT = {
  raggedRobesBaseId: 0x00013105,
  raggedBootsBaseId: 0x00013106,
  woodcuttersAxeBaseId: 0x0002f2f4,
  pickaxeBaseId: 0x000e3c16,
  goldBaseId: 0x0000000f,
  goldCount: 40,
} as const;

function applyStarterKitForNewCharacter(mp: Mp, actorId: number) {
  mp.set(actorId, "inventory", {
    entries: [
      { baseId: STARTER_KIT.goldBaseId, count: STARTER_KIT.goldCount },
      { baseId: STARTER_KIT.pickaxeBaseId, count: 1 },
      { baseId: STARTER_KIT.woodcuttersAxeBaseId, count: 1 },
      { baseId: STARTER_KIT.raggedRobesBaseId, count: 1, worn: true },
      { baseId: STARTER_KIT.raggedBootsBaseId, count: 1, worn: true },
    ],
  });

  mp.set(actorId, "private.skyv.starterKitApplied", true);
}

function randomInteger(min: number, max: number) {
  const rand = min + Math.random() * (max + 1 - min);
  return Math.floor(rand);
}

export class Spawn implements System {
  systemName = "Spawn";
  constructor(private log: Log) { }

  async initAsync(ctx: SystemContext): Promise<void> {
    const settingsObject = await Settings.get();
    const listenerFn = (userId: number, userProfileId: number, discordRoleIds: string[], discordId?: string) => {
      const { startPoints } = settingsObject;
      // TODO: Show race menu if character is not created after relogging
      let actorId = ctx.svr.getActorsByProfileId(userProfileId)[0];
      if (actorId) {
        this.log("Loading character", actorId.toString(16));
        ctx.svr.setEnabled(actorId, true);
        ctx.svr.setUserActor(userId, actorId);
      } else {
        const mp = ctx.svr as unknown as Mp;
        const idx = randomInteger(0, startPoints.length - 1);
        actorId = ctx.svr.createActor(
          0,
          startPoints[idx].pos,
          startPoints[idx].angleZ,
          +startPoints[idx].worldOrCell,
          userProfileId
        );
        this.log("Creating character", actorId.toString(16));
        ctx.svr.setUserActor(userId, actorId);
        applyStarterKitForNewCharacter(mp, actorId);
        ctx.svr.setRaceMenuOpen(actorId, true);
      }

      const mp = ctx.svr as unknown as Mp;
      mp.set(actorId, "private.discordRoles", discordRoleIds);

      if (discordId !== undefined) {
        // This helps us to test if indexes registration works in LoadForm or not
        if (mp.get(actorId, "private.indexed.discordId") !== discordId) {
          mp.set(actorId, "private.indexed.discordId", discordId);
        }

        const forms = mp.findFormsByPropertyValue("private.indexed.discordId", discordId) as number[];
        console.log(`Found forms ${forms}`);
      }
    };
    ctx.gm.on("spawnAllowed", listenerFn);
    (ctx.svr as any)._onSpawnAllowed = listenerFn;
  }

  disconnect(userId: number, ctx: SystemContext): void {
    const actorId = ctx.svr.getUserActor(userId);
    if (actorId !== 0) {
      ctx.svr.setEnabled(actorId, false);
    }
  }
}
