import {
  addPendingTx,
  getPendingTxs,
  reconcilePending,
  removePendingTx,
  PendingTx,
} from "./pendingTx";

const key = (p1: string, p2: string, w: string) => `${p1}|${p2}|${w}`;

describe("reconcilePending", () => {
  beforeEach(() => {
    localStorage.removeItem("ergo-game-pending-v1");
  });

  it("does not drop a move while the spent input box is still unspent (mempool)", () => {
    const p1 = "aa";
    const p2 = "bb";
    const wager = "1000000000";
    const spentId = "input-box-before-move";
    const op: PendingTx = {
      id: "tx-move-1",
      kind: "move",
      spentBoxId: spentId,
      predicted: {
        board: [1, 0, 0, 0, 0, 0, 0, 0, 0] as any,
        p1PubKeyHex: p1,
        p2PubKeyHex: p2,
        wagerNanoErg: wager,
      },
      predictedPhase: "ongoing",
      follow: { p1PubKeyHex: p1, p2PubKeyHex: p2, wagerNanoErg: wager },
      submittedAt: Date.now() - 20_000,
      description: "Playing cell 1",
    };
    addPendingTx(op);

    const triple = key(p1, p2, wager);
    reconcilePending({
      unspentBoxIds: new Set([spentId]),
      unspentTriples: new Set([triple]),
    });

    expect(getPendingTxs().some((p) => p.id === "tx-move-1")).toBe(true);
  });

  it("drops a move once the spent box is gone and the follow triple is still on-chain", () => {
    const p1 = "aa";
    const p2 = "bb";
    const wager = "1000000000";
    const spentId = "gone";
    const op: PendingTx = {
      id: "tx-move-2",
      kind: "move",
      spentBoxId: spentId,
      predicted: null,
      predictedPhase: "ongoing",
      follow: { p1PubKeyHex: p1, p2PubKeyHex: p2, wagerNanoErg: wager },
      submittedAt: Date.now() - 20_000,
      description: "move",
    };
    addPendingTx(op);

    const triple = key(p1, p2, wager);
    reconcilePending({
      unspentBoxIds: new Set(["new-output-box"]),
      unspentTriples: new Set([triple]),
    });

    expect(getPendingTxs().some((p) => p.id === "tx-move-2")).toBe(false);
  });

  it("clears create once the open-game triple appears (no spent box)", () => {
    const p1 = "cc";
    const wager = "500000000";
    const op: PendingTx = {
      id: "tx-create-1",
      kind: "create",
      spentBoxId: null,
      predicted: null,
      predictedPhase: "open",
      follow: { p1PubKeyHex: p1, p2PubKeyHex: p1, wagerNanoErg: wager },
      submittedAt: Date.now() - 20_000,
      description: "create",
    };
    addPendingTx(op);

    reconcilePending({
      unspentBoxIds: new Set(["new-box"]),
      unspentTriples: new Set([key(p1, p1, wager)]),
    });

    expect(getPendingTxs().some((p) => p.id === "tx-create-1")).toBe(false);
  });

  it("keeps ops younger than SETTLE_GRACE_MS even if chain already matches", () => {
    const p1 = "dd";
    const p2 = "ee";
    const wager = "1000000000";
    const op: PendingTx = {
      id: "tx-join-fast",
      kind: "join",
      spentBoxId: "open-box",
      predicted: null,
      predictedPhase: "ongoing",
      follow: { p1PubKeyHex: p1, p2PubKeyHex: p2, wagerNanoErg: wager },
      submittedAt: Date.now() - 2_000,
      description: "join",
    };
    addPendingTx(op);

    reconcilePending({
      unspentBoxIds: new Set(),
      unspentTriples: new Set([key(p1, p2, wager)]),
    });

    expect(getPendingTxs().some((p) => p.id === "tx-join-fast")).toBe(true);
    removePendingTx("tx-join-fast");
  });
});
