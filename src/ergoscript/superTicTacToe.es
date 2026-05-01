{
  // Ultimate (Super) Tic Tac Toe — same economic model as ticTacToe.es:
  // R4: Coll[Byte] length 81 — nine 3×3 boards flattened (sub0 cells 0..8, sub1, …)
  // R5: GroupElement — player 1 (X)
  // R6: GroupElement — player 2 (O); equals R5 while open
  // R7: Long — wager per player (nanoErgs)
  // R8: Long — next sub-board: -1 = play anywhere legal; 0..8 = must play in that sub
  //
  // Branches: CANCEL, JOIN, MOVE, CLAIM_X (meta), CLAIM_O (meta), DRAW (meta full, co-sign)

  val board      = SELF.R4[Coll[Byte]].get
  val p1         = SELF.R5[GroupElement].get
  val p2         = SELF.R6[GroupElement].get
  val wager      = SELF.R7[Long].get
  val constraint = SELF.R8[Long].get

  val empty: Byte = 0
  val X: Byte     = 1
  val O: Byte     = 2
  val FREE: Long  = -1L

  val count = board.fold(0, { (acc: Int, c: Byte) =>
    if (c != empty) acc + 1 else acc
  })

  val open = p1 == p2

  // ---------- helpers: board index i for sub s, cell c: i = s*9 + c ----------
  val subXWon = { (s: Int) =>
    val b = s * 9
    (board(b+0) == X && board(b+1) == X && board(b+2) == X) ||
    (board(b+3) == X && board(b+4) == X && board(b+5) == X) ||
    (board(b+6) == X && board(b+7) == X && board(b+8) == X) ||
    (board(b+0) == X && board(b+3) == X && board(b+6) == X) ||
    (board(b+1) == X && board(b+4) == X && board(b+7) == X) ||
    (board(b+2) == X && board(b+5) == X && board(b+8) == X) ||
    (board(b+0) == X && board(b+4) == X && board(b+8) == X) ||
    (board(b+2) == X && board(b+4) == X && board(b+6) == X)
  }

  val subOWon = { (s: Int) =>
    val b = s * 9
    (board(b+0) == O && board(b+1) == O && board(b+2) == O) ||
    (board(b+3) == O && board(b+4) == O && board(b+5) == O) ||
    (board(b+6) == O && board(b+7) == O && board(b+8) == O) ||
    (board(b+0) == O && board(b+3) == O && board(b+6) == O) ||
    (board(b+1) == O && board(b+4) == O && board(b+7) == O) ||
    (board(b+2) == O && board(b+5) == O && board(b+8) == O) ||
    (board(b+0) == O && board(b+4) == O && board(b+8) == O) ||
    (board(b+2) == O && board(b+4) == O && board(b+6) == O)
  }

  val subFull = { (s: Int) =>
    val b = s * 9
    board(b+0) != empty && board(b+1) != empty && board(b+2) != empty &&
    board(b+3) != empty && board(b+4) != empty && board(b+5) != empty &&
    board(b+6) != empty && board(b+7) != empty && board(b+8) != empty
  }

  val subDecided = { (s: Int) =>
    subXWon(s) || subOWon(s) || (subFull(s) && !(subXWon(s)) && !(subOWon(s)))
  }

  val metaXWon =
    (subXWon(0) && subXWon(1) && subXWon(2)) ||
    (subXWon(3) && subXWon(4) && subXWon(5)) ||
    (subXWon(6) && subXWon(7) && subXWon(8)) ||
    (subXWon(0) && subXWon(3) && subXWon(6)) ||
    (subXWon(1) && subXWon(4) && subXWon(7)) ||
    (subXWon(2) && subXWon(5) && subXWon(8)) ||
    (subXWon(0) && subXWon(4) && subXWon(8)) ||
    (subXWon(2) && subXWon(4) && subXWon(6))

  val metaOWon =
    (subOWon(0) && subOWon(1) && subOWon(2)) ||
    (subOWon(3) && subOWon(4) && subOWon(5)) ||
    (subOWon(6) && subOWon(7) && subOWon(8)) ||
    (subOWon(0) && subOWon(3) && subOWon(6)) ||
    (subOWon(1) && subOWon(4) && subOWon(7)) ||
    (subOWon(2) && subOWon(5) && subOWon(8)) ||
    (subOWon(0) && subOWon(4) && subOWon(8)) ||
    (subOWon(2) && subOWon(4) && subOWon(6))

  val metaDrawn =
    subDecided(0) && subDecided(1) && subDecided(2) &&
    subDecided(3) && subDecided(4) && subDecided(5) &&
    subDecided(6) && subDecided(7) && subDecided(8) &&
    !metaXWon && !metaOWon

  val ongoing = !open && !metaXWon && !metaOWon && !metaDrawn

  val p1Turn    = count % 2 == 0
  val mover     = if (p1Turn) p1 else p2
  val moverSym  = if (p1Turn) X else O

  val cancelBranch = open

  val joinBranch = open && {
    val out = OUTPUTS(0)
    out.propositionBytes == SELF.propositionBytes &&
    out.R4[Coll[Byte]].get == board &&
    out.R5[GroupElement].get == p1 &&
    out.R6[GroupElement].get != p1 &&
    out.R7[Long].get == wager &&
    out.R8[Long].get == constraint &&
    out.value >= SELF.value + wager
  }

  // MOVE: one empty -> moverSym; legal sub-board; R8' from Ultimate rule
  val moveBranch = ongoing && {
    val out          = OUTPUTS(0)
    val newBoard     = out.R4[Coll[Byte]].get
    val newConstr    = out.R8[Long].get
    val pairs        = board.zip(newBoard)
    val changeCount = pairs.fold(0, { (acc: Int, pr: (Byte, Byte)) =>
      if (pr._1 != pr._2) acc + 1 else acc
    })
    val allCellsValid = pairs.forall { (pr: (Byte, Byte)) =>
      pr._1 == pr._2 || (pr._1 == empty && pr._2 == moverSym)
    }

    // Single changed cell index (0..80) — exactly one diff required
    val IDX = Coll(0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80)
    val changedIdx = IDX.fold(-1, { (acc: Int, i: Int) =>
      if (acc >= 0) acc
      else if (board(i) != newBoard(i)) i
      else -1
    })

    val playSub = changedIdx / 9
    val playCell = changedIdx % 9

    val subLegal =
      (constraint == FREE) ||
      (constraint >= 0L && constraint <= 8L && playSub == constraint.toInt)

    val targetNext = playCell
    val tBase = targetNext * 9
    val nextTargetDecided =
      (newBoard(tBase+0) != empty && newBoard(tBase+1) != empty && newBoard(tBase+2) != empty &&
       newBoard(tBase+3) != empty && newBoard(tBase+4) != empty && newBoard(tBase+5) != empty &&
       newBoard(tBase+6) != empty && newBoard(tBase+7) != empty && newBoard(tBase+8) != empty) &&
      !(
        (newBoard(tBase+0) == X && newBoard(tBase+1) == X && newBoard(tBase+2) == X) ||
        (newBoard(tBase+3) == X && newBoard(tBase+4) == X && newBoard(tBase+5) == X) ||
        (newBoard(tBase+6) == X && newBoard(tBase+7) == X && newBoard(tBase+8) == X) ||
        (newBoard(tBase+0) == X && newBoard(tBase+3) == X && newBoard(tBase+6) == X) ||
        (newBoard(tBase+1) == X && newBoard(tBase+4) == X && newBoard(tBase+7) == X) ||
        (newBoard(tBase+2) == X && newBoard(tBase+5) == X && newBoard(tBase+8) == X) ||
        (newBoard(tBase+0) == X && newBoard(tBase+4) == X && newBoard(tBase+8) == X) ||
        (newBoard(tBase+2) == X && newBoard(tBase+4) == X && newBoard(tBase+6) == X) ||
        (newBoard(tBase+0) == O && newBoard(tBase+1) == O && newBoard(tBase+2) == O) ||
        (newBoard(tBase+3) == O && newBoard(tBase+4) == O && newBoard(tBase+5) == O) ||
        (newBoard(tBase+6) == O && newBoard(tBase+7) == O && newBoard(tBase+8) == O) ||
        (newBoard(tBase+0) == O && newBoard(tBase+3) == O && newBoard(tBase+6) == O) ||
        (newBoard(tBase+1) == O && newBoard(tBase+4) == O && newBoard(tBase+7) == O) ||
        (newBoard(tBase+2) == O && newBoard(tBase+5) == O && newBoard(tBase+8) == O) ||
        (newBoard(tBase+0) == O && newBoard(tBase+4) == O && newBoard(tBase+8) == O) ||
        (newBoard(tBase+2) == O && newBoard(tBase+4) == O && newBoard(tBase+6) == O)
      )

    val expectConstr = if (nextTargetDecided) FREE else targetNext.toLong

    newBoard.size == 81 &&
    changeCount == 1 &&
    changedIdx >= 0 &&
    allCellsValid &&
    subLegal &&
    !(subDecided(playSub)) &&
    board(changedIdx) == empty &&
    newConstr == expectConstr &&
    out.propositionBytes == SELF.propositionBytes &&
    out.R5[GroupElement].get == p1 &&
    out.R6[GroupElement].get == p2 &&
    out.R7[Long].get == wager &&
    out.value >= SELF.value
  }

  (cancelBranch && proveDlog(p1))             ||
  joinBranch                                   ||
  (moveBranch   && proveDlog(mover))          ||
  (metaXWon     && proveDlog(p1))             ||
  (metaOWon     && proveDlog(p2))             ||
  (metaDrawn    && proveDlog(p1) && proveDlog(p2))
}
