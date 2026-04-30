{
  // ============================================================
  // Tic-tac-toe game contract for the ergo-basic-template.
  //
  // A single on-chain box represents the entire state of one game.
  // Registers:
  //   R4: Coll[Byte], length 9          -- the board
  //                                         0 = empty, 1 = X (player 1),
  //                                         2 = O (player 2)
  //   R5: GroupElement                  -- player 1's public key
  //   R6: GroupElement                  -- player 2's public key
  //                                         (equal to R5 while the game
  //                                          is "open" / unjoined)
  //   R7: Long                          -- wager per player (nanoErgs)
  //
  // Value invariants:
  //   open state     (p1 == p2): box holds >= wager
  //   joined state   (p1 != p2): box holds >= 2 * wager
  //
  // Transaction branches enforced by this contract:
  //
  //   CANCEL: open state, creator (p1) recovers their wager.
  //           Any outputs allowed; only p1's signature is required.
  //
  //   JOIN:   open state -> joined state. Any wallet with a matching
  //           wager can join; the spending tx creates a new box at
  //           this same contract with R6 replaced by the joiner's
  //           public key and the box value topped up by `wager`.
  //
  //   MOVE:   joined state + game still ongoing -> new game box with
  //           exactly one additional cell filled with the current
  //           mover's symbol. Turn order is enforced by parity of
  //           non-empty cells (even -> p1's turn -> X; odd -> p2 -> O).
  //           Only the current mover's signature is accepted.
  //
  //   CLAIM_X / CLAIM_O: if the board shows a three-in-a-row for X/O,
  //           only that player can spend the box. They may drain the
  //           full 2*wager (winner takes all). Outputs are otherwise
  //           unconstrained — the winner can do whatever they want
  //           with their winnings.
  //
  //   DRAW:   full board with no winner -> both players must co-sign
  //           to drain. Phase 1 intentionally does NOT enforce an
  //           automatic 50/50 split; instead it requires cooperative
  //           consent to keep the contract small. If either party
  //           disappears, the pot deadlocks until we ship Phase 2's
  //           timeout escape.
  //
  // Known Phase-1 limitations (documented honestly):
  //
  //   * No abandonment timeout. If p2 stops playing mid-game, the
  //     wager is stuck until they sign again (or we deploy Phase 2).
  //   * No on-chain NFT mint on win. Phase 2 will add that as part of
  //     the claim transaction.
  //   * Only strict win/loss/draw outcomes; no "forfeit".
  //
  // Known Phase-1 security caveats:
  //
  //   * This contract has not been audited. The Phase-1 UI warns
  //     the user loudly before accepting a wager. Test with tiny
  //     amounts first.
  // ============================================================

  val board  = SELF.R4[Coll[Byte]].get
  val p1     = SELF.R5[GroupElement].get
  val p2     = SELF.R6[GroupElement].get
  val wager  = SELF.R7[Long].get

  val empty: Byte = 0
  val X: Byte     = 1
  val O: Byte     = 2

  // Non-empty cell count (0..9).
  val count = board.fold(0, { (acc: Int, c: Byte) =>
    if (c != empty) acc + 1 else acc
  })

  val open = p1 == p2

  // Three-in-a-row predicate, unrolled across all 8 lines.
  val xWon =
    (board(0) == X && board(1) == X && board(2) == X) ||
    (board(3) == X && board(4) == X && board(5) == X) ||
    (board(6) == X && board(7) == X && board(8) == X) ||
    (board(0) == X && board(3) == X && board(6) == X) ||
    (board(1) == X && board(4) == X && board(7) == X) ||
    (board(2) == X && board(5) == X && board(8) == X) ||
    (board(0) == X && board(4) == X && board(8) == X) ||
    (board(2) == X && board(4) == X && board(6) == X)

  val oWon =
    (board(0) == O && board(1) == O && board(2) == O) ||
    (board(3) == O && board(4) == O && board(5) == O) ||
    (board(6) == O && board(7) == O && board(8) == O) ||
    (board(0) == O && board(3) == O && board(6) == O) ||
    (board(1) == O && board(4) == O && board(7) == O) ||
    (board(2) == O && board(5) == O && board(8) == O) ||
    (board(0) == O && board(4) == O && board(8) == O) ||
    (board(2) == O && board(4) == O && board(6) == O)

  val drawn   = count == 9 && !xWon && !oWon
  val ongoing = !open && !xWon && !oWon && !drawn

  val p1Turn    = count % 2 == 0
  val mover     = if (p1Turn) p1 else p2
  val moverSym  = if (p1Turn) X else O

  // ---------- CANCEL branch ----------
  // Open games can be cancelled by the creator at any time before
  // a second player joins.
  val cancelBranch = open

  // ---------- JOIN branch ----------
  // Anyone can join by matching the wager. The output re-uses this
  // contract, preserves board / p1 / wager, sets a new p2 != p1,
  // and tops up the box value by `wager`.
  val joinBranch = open && {
    val out = OUTPUTS(0)
    out.propositionBytes == SELF.propositionBytes &&
    out.R4[Coll[Byte]].get == board &&
    out.R5[GroupElement].get == p1 &&
    out.R6[GroupElement].get != p1 &&
    out.R7[Long].get == wager &&
    out.value >= SELF.value + wager
  }

  // ---------- MOVE branch ----------
  // Game is ongoing; the tx continues into a new box at this contract
  // with exactly one additional cell filled by the current mover's
  // symbol. Registers R5 / R6 / R7 are preserved.
  val moveBranch = ongoing && {
    val out       = OUTPUTS(0)
    val newBoard  = out.R4[Coll[Byte]].get
    val pairs     = board.zip(newBoard)

    // For each cell: either unchanged, or newly filled with
    // exactly the current mover's symbol.
    val allCellsValid = pairs.forall { (pr: (Byte, Byte)) =>
      pr._1 == pr._2 || (pr._1 == empty && pr._2 == moverSym)
    }

    // Exactly one cell differs between old and new boards.
    val changeCount = pairs.fold(0, { (acc: Int, pr: (Byte, Byte)) =>
      if (pr._1 != pr._2) acc + 1 else acc
    })

    newBoard.size == 9 &&
    changeCount == 1 &&
    allCellsValid &&
    out.propositionBytes == SELF.propositionBytes &&
    out.R5[GroupElement].get == p1 &&
    out.R6[GroupElement].get == p2 &&
    out.R7[Long].get == wager &&
    out.value >= SELF.value
  }

  // ---------- Final sigma gating ----------
  //
  // The OR below enumerates every legal transaction branch and
  // attaches the minimum-required-signer gating to each one:
  //
  //   cancelBranch -> requires p1
  //   joinBranch   -> requires no one specific (anyone with matching
  //                   wager can construct it; the joiner's own inputs
  //                   cover the top-up funding and require their own
  //                   signatures independently)
  //   moveBranch   -> requires the current mover
  //   xWon         -> only p1 can claim
  //   oWon         -> only p2 can claim
  //   drawn        -> both p1 AND p2 must co-sign

  (cancelBranch && proveDlog(p1))             ||
  joinBranch                                   ||
  (moveBranch   && proveDlog(mover))          ||
  (xWon         && proveDlog(p1))             ||
  (oWon         && proveDlog(p2))             ||
  (drawn        && proveDlog(p1) && proveDlog(p2))
}
