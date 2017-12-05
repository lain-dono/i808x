'use strict'

function parity8(bit, is_even) {
    bit &= 0xFF // clear
    let parity = (!is_even) & 1
    while (bit) {
        parity ^= bit & 1
        bit >>= 1
    }
    return parity
}

test_parity8()

function test_parity8() {
    for (let i = 0; i <= 0xFF; i++) {
        let even = parity8(i, false)
        let odd = parity8(i, true)
        console.assert(even !== odd, '[%d] %d %d', i, even, odd)
    }

    console.assert(parity8(0x00) === 1, '0000_0000 === 1')
    console.assert(parity8(0x80) === 0, '1000_0000 === 0')
    console.assert(parity8(0xFF) === 1, '1111_1111 === 1')
    console.assert(parity8(0x76) === 0, '0111_0110 === 0')
    console.assert(parity8(0x6F) === 1, '0110_1111 === 1')
}

//                                       abc cs
console.assert(full_adder(0,0,0) === 0, '000 00')
console.assert(full_adder(0,0,1) === 1, '001 01')
console.assert(full_adder(0,1,0) === 1, '010 01')
console.assert(full_adder(0,1,1) === 2, '011 10')
console.assert(full_adder(1,0,0) === 1, '100 01')
console.assert(full_adder(1,0,1) === 2, '101 10')
console.assert(full_adder(1,1,0) === 2, '110 10')
console.assert(full_adder(1,1,1) === 3, '111 11')

function full_adder(a, b, c) {
    //return a + b + c

    let xor = a ^ b
    let and = a & b
    let s = (xor ^ c)
    c = and | (xor & c)
    return s | (c << 1)
}

if (true) {
    let a = 0xFF
    let b = 0xFF
    let v = addsub(a, b, 8, true)
    console.log("[%d - %d = %d #%d]", a, b, v & 0xFF, v >> 8, a - b, v)
}

function sub(a, b, c) {
    return a + ((~b) + 1) + c
}

function addsub(a_bits, b_bits, count, sw) {
    let c = sw & 1
    let s = 0
    for (let i = 0; i < count; i++) {
        let a = (a_bits >> i) & 1
        let b = (b_bits >> i) & 1

        b = b ^ sw

        // full adder
        let xor = a ^ b
        let and = a & b
        s |= (xor ^ c) << i
        c = and | (xor & c)
    }
    if (sw) {
        return s | ((!c) << count)
    } else {
        return s | (c << count)
    }
}


function CPU() {
    this.register_buffer = new ArrayBuffer(6)
    this.reg8 = new Uint8Array(this.register_buffer)
    this.reg16 = new Uint16Array(this.register_buffer)

    this.memory = new Uint8Array(0xFFFF)

    this.flags = 0
    this.accumulator = 0
    this.program_counter = 0
}

CPU.prototype.A = function(value) {
    if (typeof value != 'undefined') {
        this.accumulator = value
    } else {
        return this.accumulator
    }
}

CPU.prototype.M = function(value) {
    if (typeof value != 'undefined') {
        this.memory[this.HL()] = value
    } else {
        return this.memory[this.HL()]
    }
}

CPU.prototype.B = function(value) { return this.reg8(0, value) }
CPU.prototype.C = function(value) { return this.reg8(1, value) }
CPU.prototype.D = function(value) { return this.reg8(2, value) }
CPU.prototype.E = function(value) { return this.reg8(3, value) }
CPU.prototype.H = function(value) { return this.reg8(4, value) }
CPU.prototype.L = function(value) { return this.reg8(5, value) }

CPU.prototype.BC = function(value) {
    let h = this.B(value >> 8)
    let l = this.C(value & 0xFF)
    return (h << 8) | l
}

CPU.prototype.DE = function(value) {
    let h = this.D(value >> 8)
    let l = this.E(value & 0xFF)
    return (h << 8) | l
}

CPU.prototype.HL = function(value) {
    let h = this.H(value >> 8)
    let l = this.L(value & 0xFF)
    return (h << 8) | l
}

CPU.prototype.reg8 = function(id, value) {
    if (typeof value != 'undefined') {
        this.register8[id] = value
    } else {
        return this.register8[id]
    }
}

CPU.prototype.by_code = function(code, value) {
    switch (code) {
        case 0: return this.B(value) // 000 B
        case 1: return this.C(value) // 001 C
        case 2: return this.D(value) // 010 D
        case 3: return this.E(value) // 011 E
        case 4: return this.H(value) // 100 H
        case 5: return this.L(value) // 101 L
        case 6: return this.M(value) // 110 M
        case 7: return this.A(value) // 111 A
        default: throw 'wtf?'
    }
}

CPU.prototype.run_mov = function(cmd) {
    let dst = (cmd >> 3) & 7
    let src = (cmd >> 0) & 7
    if (dst === 6 && src == 6) {
        throw 'HLT'
    }
    this.by_code(dst, this.by_code(src))
}

CPU.prototype.sign_zero_parity = function(cmd) {
    let a = this.A()
    // sign
    this.flags |= a & 0x80
    // zero
    this.flags |= (a == 0) << 6
    // parity
    this.flags |= parity8(a) << 2
}

CPU.prototype.run_alu = function(cmd) {
    // TODO: Auxiliary Carry
    let knd = (cmd >> 3) & 7
    let src = (cmd >> 0) & 7
    let b = this.by_code(src)

    let carry = this.flags & 1
    let a = this.A()

    let h = a & 0xF
    let l = a >> 4

    let C
    let AC
    switch (knd) {
    case 0: // ADD
        this.A(a + b)
        C = a > 0xFF
        //AC = (h + operand & 0xF) > 0xF
        this.sign_zero_parity()
        break
    case 1: // ADC
        this.A(a + b + carry)
        C = a > 0xFF
        this.sign_zero_parity()
        //AC = (h + operand & 0xF + carry) > 0xF
        break
    case 2: // SUB
        this.A(a + (~b) + 1)
        C = a > 0xFF
        this.sign_zero_parity()
        //high += operand & 0xF
        break
    case 3: // SBB
        this.A(a + (~(b+ carry)) + 1)
        C = a > 0xFF
        this.sign_zero_parity()
        break

    case 4: // ANA
        a &= b
        C = 0
        this.sign_zero_parity()
        break
    case 5: // XRA
        a ^= b
        C = 0
        this.sign_zero_parity()
        break
    case 6: // ORA
        a |= b
        C = 0
        this.sign_zero_parity()
        break

    case 7: // CMP
        Z = (a === b) & 1
        C = (a < b) & 1
        if ((a >> 7) != (b >> 7)) {
            C = 0
        }
        break

    default: throw 'wtf?'
    }

        /*
    REG8[A] = a & 0xFF

    let AC; // Признак вспомогательного переноса. Если есть перенос между тетрадами байта, то АС=1, иначе АС=0.

    let AC = (high > 0xFF || low < 0) & 1
    let C = (a > 0xFF || a < 0) & 1

    REG[F] = (S << 7) | (Z << 6) | (AC << 4) | (P << 2) | C

    this.sign_zero_parity()
        */
}
