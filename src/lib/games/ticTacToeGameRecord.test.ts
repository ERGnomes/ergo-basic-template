import {
  gameRecordFromHistory,
  parseGameRecord,
  stringifyGameRecord,
} from "./ticTacToeGameRecord";
import type { ExplorerBoxLike } from "./ticTacToeContract";
import type { GameState } from "./ticTacToeContract";
import type { GameHistorySnapshot } from "./ticTacToeDiscovery";

const emptyState = (p1: string): GameState => ({
  board: [0, 0, 0, 0, 0, 0, 0, 0, 0] as any,
  p1PubKeyHex: p1,
  p2PubKeyHex: p1,
  wagerNanoErg: BigInt("1000000000"),
});

const mockBox = (over: Partial<ExplorerBoxLike>): ExplorerBoxLike => ({
  boxId: "b1",
  value: "2000000000",
  transactionId: "txcreate",
  spentTransactionId: "txclose",
  settlementHeight: 100,
  ...over,
});

describe("ticTacToeGameRecord", () => {
  it("round-trips JSON", () => {
    const h: GameHistorySnapshot = {
      box: mockBox({}),
      state: emptyState("aa"),
      phase: "open",
      isJoined: false,
      settlementHeight: 100,
      spentTransactionId: "cc".repeat(32),
    };
    const rec = gameRecordFromHistory(h, "9iMoHi8FUVh2RdFv3YD6xjjfxZ6nPqEjQbmxQzHbpBFE6hWxouq");
    const s = stringifyGameRecord(rec);
    const back = parseGameRecord(s);
    expect(back.boxId).toBe("b1");
    expect(back.outcome).toBe("open_unjoined");
    expect(back.schemaVersion).toBe(1);
  });
});
