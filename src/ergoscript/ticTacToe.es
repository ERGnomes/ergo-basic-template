{
  // ============================================================
  // Tic-tac-toe game contract for the ergo-dapp-starter template.
  //
  // Registers:
  //   R4: Coll[Byte], length 9   — board (0 empty, 1 X, 2 O)
  //   R5: GroupElement           — player 1 (X)
  //   R6: GroupElement           — player 2 (O); equals R5 while open
  //   R7: Long                   — wager per player (nanoErgs)
  //   R8: Long                   — block height of last on-chain activity
  //                                  (set at create/join; updated each MOVE;
  //                                   must satisfy lastActive <= R8 <= HEIGHT)
  //
  // Branches: CANCEL, JOIN, MOVE, CLAIM_X, CLAIM_O, DRAW,
  //           IDLE_REFUND (waiting player refunds both after inactivity)
  // ============================================================

  val board  = SELF.R4[Coll[Byte]].get
  val p1     = SELF.R5[GroupElement].get
  val p2     = SELF.R6[GroupElement].get
  val wager  = SELF.R7[Long].get
  val lastActive = SELF.R8[Long].get

  val empty: Byte = 0
  val X: Byte     = 1
  val O: Byte     = 2

  val idleBlocks = 5040L
  val feeAllow = 5000000L

  val count = board.fold(0, { (acc: Int, c: Byte) =>
    if (c != empty) acc + 1 else acc
  })

  val open = p1 == p2

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
  val waiter    = if (p1Turn) p2 else p1

  val cancelBranch = open

  // R8 = last activity height. Require monotonic update and "not in the future"
  // so mempool validation still passes when HEIGHT advances past the tip the
  // client used when building the tx (Explorer vs block-attachment skew).
  val joinBranch = open && {
    val out = OUTPUTS(0)
    val newLA = out.R8[Long].get
    out.propositionBytes == SELF.propositionBytes &&
    out.R4[Coll[Byte]].get == board &&
    out.R5[GroupElement].get == p1 &&
    out.R6[GroupElement].get != p1 &&
    out.R7[Long].get == wager &&
    newLA >= lastActive &&
    newLA <= HEIGHT &&
    out.value >= SELF.value + wager
  }

  val moveBranch = ongoing && {
    val out       = OUTPUTS(0)
    val newBoard  = out.R4[Coll[Byte]].get
    val newLA     = out.R8[Long].get
    val pairs     = board.zip(newBoard)

    val allCellsValid = pairs.forall { (pr: (Byte, Byte)) =>
      pr._1 == pr._2 || (pr._1 == empty && pr._2 == moverSym)
    }

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
    newLA >= lastActive &&
    newLA <= HEIGHT &&
    out.value >= SELF.value
  }

  val idleRefundBranch = ongoing &&
    HEIGHT > lastActive + idleBlocks &&
    OUTPUTS.size >= 2 &&
    OUTPUTS(0).value >= wager - feeAllow &&
    OUTPUTS(1).value >= wager - feeAllow &&
    blake2b256(proveDlog(p1).propBytes) == blake2b256(OUTPUTS(0).propositionBytes) &&
    blake2b256(proveDlog(p2).propBytes) == blake2b256(OUTPUTS(1).propositionBytes)

  (cancelBranch && proveDlog(p1))             ||
  joinBranch                                   ||
  (moveBranch   && proveDlog(mover))          ||
  (idleRefundBranch && proveDlog(waiter))    ||
  (xWon         && proveDlog(p1))             ||
  (oWon         && proveDlog(p2))             ||
  (drawn        && proveDlog(p1) && proveDlog(p2))
}
