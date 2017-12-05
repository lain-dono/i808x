Cpu.prototype.run_command = function(cmd) {
    let op = (cmd >> 6) & 3
    switch (op) {
    case 0:
    case 1:
        return this.LOAD(cmd)
    case 2:
        return this.ALU(cmd)
    case 3:
    }
}


Cpu.prototype.by_code = function(src) {
    switch (src) {
        case 0: return this.b // 000 B
        case 1: return this.c // 001 C
        case 2: return this.d // 010 D
        case 3: return this.e // 011 E
        case 4: return this.h // 100 H
        case 5: return this.l // 101 L
        case 6: return this.memio.rd(this.hl()) // 110 M
        case 7: return this.a // 111 A
        default: throw 'wtf?'
    }
}

Cpu.prototype.set_by_code = function(dst, op) {
    switch (dst) {
    case 0: // 000 B
        this.b = op
        break
    case 1: // 001 C
        this.c = op
        break
    case 2: // 010 D
        this.d = op
        break
    case 3: // 011 E
        this.e = op
        break
    case 4: // 100 H
        this.h = op
        break
    case 5: // 101 L
        this.l = op
        break
    case 6: // 110 M
        this.writeByte(this.hl(), op)
        break
    case 7: // 111 A
        this.a = op
        break
    }
}

// 10xxxxxx
Cpu.prototype.ALU = function(cmd) {
    let knd = (cmd >> 3) & 7
    let src = (cmd >> 0) & 7
    this.cycles += 4

    // for M
    if (src === 6) this.cycles += 3

    let op = this.by_code(src)
    switch (knd) {
    case 0: // ADD
        this.a = this.addByte(this.a, op)
        break
    case 1: // ADC
        this.a = this.addByteWithCarry(this.a, op)
        break
    case 2: // SUB
        this.a = this.subtractByte(this.a, op)
        break
    case 3: // SBB
        this.a = this.subtractByteWithCarry(this.a, op)
        break
    case 4: // ANA
        this.a = this.andByte(this.a, op)
        break
    case 5: // XRA
        this.a = this.xorByte(this.a, op)
        break
    case 6: // ORA
        this.a = this.orByte(this.a, op)
        break
    case 7: // CMP
        this.subtractByte(this.a, op);
        break
    }

    return true
}

// 01xxxxxx
Cpu.prototype.LOAD = function(cmd) {
    let dst = (cmd >> 3) & 7
    let src = (cmd >> 0) & 7
    this.cycles += 5
    // for M
    if (src === 6 || dst === 6) this.cycles += 2
    // HLT
    if (src === 6 && dst === 6) return false
    this.set_by_code(dst, this.by_code(src))
    return true
}

// 00xxxxxx
Cpu.prototype.SINGLE = function(cmd) {
    let dst = (cmd >> 3) & 7
    let knd = (cmd >> 0) & 7

    switch (knd) {
    case 7:
        // 4 - DAA
        // 5 - CMA
        // 6 - STC set carry
        // 7 - CMC clear carry
    case 4: // INR ++
    case 5: // DCR --

    break
    }

1 1 1
