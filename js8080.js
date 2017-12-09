'use strict'

// js8080 original by Chris Double (http://www.bluishcoder.co.nz/js8080/)
//        modified by Stefan Tramm, 2010
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice,
//    this list of conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES,
// INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
// FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
// DEVELOPERS AND CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
// OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
// WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
// OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
// ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
var CARRY     = 0x01;
var PARITY    = 0x04;
var HALFCARRY = 0x10;
var INTERRUPT = 0x20;
var ZERO      = 0x40;
var SIGN      = 0x80;

function Cpu(memio, interrupt) {
  this.b = 0;
  this.c = 0;
  this.d = 0;
  this.e = 0;
  this.f = 0;
  this.h = 0;
  this.l = 0;
  this.a = 0;
  this.pc = 0;
  this.sp = 0xF000; // TBD
  this.memio = memio;
  this.ram = memio.ram; // should only be used by the disass
  this.lastInterrupt = 0x10;
  this.cycles = 0;
  this.interrupt = interrupt;
}

Cpu.prototype.reset = function() {
  this.b = 0;
  this.c = 0;
  this.d = 0;
  this.e = 0;
  this.f = 0;
  this.h = 0;
  this.l = 0;
  this.a = 0;
  this.pc = 0;
  this.sp = 0xF000; // TBD

  this.cycles = 0;
}

window.Cpu = Cpu

Cpu.prototype.af = function() {
  return this.a << 8 | this.f;
};

Cpu.prototype.AF = function(n) {
  this.a = n >> 8 & 0xFF;
  this.f = n & 0xFF;
}

Cpu.prototype.bc = function () {
  return this.b << 8 | this.c;
};

Cpu.prototype.BC = function(n) {
  this.b = n >> 8 & 0xFF;
  this.c = n & 0xFF;
}

Cpu.prototype.de = function () {
  return this.d << 8 | this.e;
};

Cpu.prototype.DE = function(n) {
  this.d = n >> 8 & 0xFF;
  this.e = n & 0xFF;
}

Cpu.prototype.hl = function () {
  return this.h << 8 | this.l;
};

Cpu.prototype.HL = function(n) {
  this.h = n >> 8 & 0xFF;
  this.l = n & 0xFF;
};

Cpu.prototype.set = function(flag) {
  this.f |= flag;
};

Cpu.prototype.clear = function(flag) {
  this.f &= ~flag & 0xFF ;
};

Cpu.prototype.toString = function() {
  return "{" +
    " af: " + pad(this.af().toString(16),4) +
    " bc: " + pad(this.bc().toString(16),4) +
    " de: " + pad(this.de().toString(16),4) +
    " hl: " + pad(this.hl().toString(16),4) +
    " pc: " + pad(this.pc.toString(16),4) +
    " sp: " + pad(this.sp.toString(16),4) +
    " flags: " +
    (this.f & ZERO ? "z" : ".") +
    (this.f & SIGN ? "s" : ".") +
    (this.f & PARITY ? "p" : ".") +
    (this.f & CARRY ? "c" : ".") +
    " " + this.disassemble1(this.pc)[1] +
    " }";
};

Cpu.prototype.cpuStatus = function() {
  var s = "";
  s += " AF:"+pad(this.af().toString(16),4);
  s += " " +
      (this.f & SIGN ? "s" : ".") +
      (this.f & ZERO ? "z" : ".") +
      (this.f & INTERRUPT ? "I" : ".") +
      (this.f & HALFCARRY ? "h" : ".") +
      (this.f & PARITY ? "p" : ".") +
      (this.f & CARRY ? "c" : ".");
  s += " BC:"+pad(this.bc().toString(16),4);
  s += " DE:"+pad(this.de().toString(16),4);
  s += " HL:"+pad(this.hl().toString(16),4);
  s += " (HL):"+pad(this.memio.rd(this.hl()).toString(16),2);
  s += " SP:"+pad(this.sp.toString(16),4);
  s += " PC:"; //+pad(this.pc.toString(16),4);
  s += this.disassemble1(this.pc)[1];
  //s += " [" + this.cycles + "]";
  return s;
}

// Step through one instruction
Cpu.prototype.step = function() {
  var i = this.memio.rd(this.pc++);
  this.pc &= 0xFFFF;
  var r = this.execute(i);
  this.processInterrupts();
  return r;
};

Cpu.prototype.writePort = function (port, v) {
  this.memio.output(port, v);
  return this;
};

Cpu.prototype.readPort = function (port) {
  return this.memio.input(port);
};

Cpu.prototype.getByte = function (addr) {
  return this.memio.rd(addr);
};

Cpu.prototype.getWord = function (addr) {
  var l = this.memio.rd(addr);
  var h = this.memio.rd(addr+1);
  return h << 8 | l;
};

Cpu.prototype.nextByte = function() {
  var b = this.memio.rd(this.pc++);
  this.pc &= 0xFFFF;
  return b;
};

Cpu.prototype.nextWord = function() {
  var pc = this.pc;
  var l = this.memio.rd(pc++);
  var h = this.memio.rd(pc++);
  this.pc = pc & 0xFFFF;
  return h << 8 | l;
};

Cpu.prototype.writeByte = function(addr, value) {
  var v = value & 0xFF;
  this.memio.wr(addr, v);
  return this;
};

Cpu.prototype.writeWord = function(addr, value) {
  var l = value;
  var h = value >> 8;
  this.writeByte(addr, l);
  this.writeByte(addr+1, h);
  return this;
};

// use this for address arithmetic
Cpu.prototype.add = function(a, b) {
  return (a + b) & 0xffff;
}

// set flags after arithmetic and logical ops
Cpu.prototype.calcFlags = function(v, lhs, rhs) {
  var x = v & 0xFF;

  // calc parity (see Henry S. Warren "Hackers Delight", page 74)
  var y = x ^ (x >> 1);
  y ^= y >> 2;
  y ^= y >> 4;

  if (y & 1)
    this.f &= ~PARITY & 0xFF; // PO
  else
    this.f |= PARITY; // PE

  if (v & 0x80)
    this.f |= SIGN;
  else
    this.f &= ~SIGN & 0xFF;

  if (x)
    this.f &= ~ZERO & 0xFF;
  else
    this.f |= ZERO;

  if (((rhs ^ v) ^ lhs) & 0x10)
    this.f |= HALFCARRY;
  else
    this.f &= ~HALFCARRY & 0xFF;

  if (v >= 0x100 || v < 0)
    this.f |= CARRY;
  else
    this.f &= ~CARRY & 0xFF;

  return x;
}

Cpu.prototype.incrementByte = function(o) {
  var c = this.f & CARRY; // carry isnt affected
  var r = this.calcFlags(o+1, o, 1);
  this.f = (this.f & ~CARRY & 0xFF) | c;
  return r;
};

Cpu.prototype.decrementByte = function(o) {
  var c = this.f & CARRY; // carry isnt affected
  var r = this.calcFlags(o-1, o, 1);
  this.f = (this.f & ~CARRY & 0xFF) | c;
  return r;
};

Cpu.prototype.addByte = function(lhs, rhs) {
  return this.calcFlags(lhs + rhs, lhs, rhs);
};

Cpu.prototype.addByteWithCarry = function(lhs, rhs) {
  return this.addByte(lhs, rhs + ((this.f & CARRY) ? 1 : 0));
};

Cpu.prototype.subtractByte = function(lhs, rhs) {
  return this.calcFlags(lhs - rhs, lhs, rhs);
};

Cpu.prototype.subtractByteWithCarry = function(lhs, rhs) {
  return this.subtractByte(lhs, rhs + ((this.f & CARRY) ? 1 : 0));
};

Cpu.prototype.andByte = function(lhs, rhs) {
  var x = this.calcFlags(lhs & rhs, lhs, rhs);
  this.f |= HALFCARRY;
  this.f &= ~CARRY & 0xFF;
  return x;
};

Cpu.prototype.xorByte = function(lhs, rhs) {
  var x = this.calcFlags(lhs ^ rhs, lhs, rhs);
  this.f |= HALFCARRY;
  this.f &= ~CARRY & 0xFF;
  return x;
};

Cpu.prototype.orByte = function(lhs, rhs) {
  var x = this.calcFlags(lhs | rhs, lhs, rhs);
  this.f |= HALFCARRY;
  this.f &= ~CARRY & 0xFF;
  return x;
};

Cpu.prototype.addWord = function(lhs, rhs) {
  var r = lhs + rhs;
  if (r > 0xFFFF)
    this.f |= CARRY;
  else
    this.f &= ~CARRY & 0xFF;
  return r & 0xFFFF;
};

Cpu.prototype.pop = function() {
  var pc = this.getWord(this.sp);
  this.sp = (this.sp + 2) & 0xFFFF;
  return pc;
};

Cpu.prototype.push = function(v) {
  this.sp = (this.sp - 2) & 0xFFFF;
  this.writeWord(this.sp, v)
};

Cpu.prototype.processInterrupts = function() {
  if (this.cycles < 1000000000)
    return null;
  this.cycles -= 1000000000;
  return null;

  if (this.cycles < 16667)
    return;

  this.cycles -= 16667;
  this.lastInterrupt = 0x08;

  if (this.f & INTERRUPT) {
    this.push(this.pc);
    this.pc = this.lastInterrupt;
    if (this.interrupt)
      interrupt.apply(this, [this.lastInterrupt]);
  }
};

// returns false for HALT and illegal instr., else returns true
Cpu.prototype.execute = function(i) {
  let cmd = i
  let result = this.run_command(cmd)
  if (typeof result != 'undefined') {
    return result
  }

  let _op = (cmd >> 6) & 3
  if (_op == 1 || _op == 2) {
    throw 'wtf?'
  }


  switch(i) {
  case 0x00: // NOP
    this.cycles += 4;
    break
  case 0x01: // LD BC,nn
    this.BC(this.nextWord());
    this.cycles += 10;
    break;
  case 0x02: // LD (BC),A
    this.writeByte(this.bc(), this.a);
    this.cycles += 7;
    break;
  case 0x03: // INC BC
    this.BC((this.bc() + 1) & 0xFFFF);
    this.cycles += 6;
    break;
  case 0x04: // INC  B
    this.b = this.incrementByte(this.b);
    this.cycles += 5 ;
    break;
  case 0x05: // DEC  B
    this.b = this.decrementByte(this.b);
    this.cycles += 5;
    break;
  case 0x06: // LD   B,n
    this.b = this.nextByte();
    this.cycles += 7;
    break;
  case 0x07:
    {
      // RLCA
      var l = (this.a & 0x80) >> 7;
      if (l)
        this.f |= CARRY;
      else
        this.f &= ~CARRY & 0xFF;

      this.a = ((this.a << 1) & 0xFE) | l;
      this.cycles += 4;
    }
    break;
  case 0x09: // ADD  HL,BC
    this.HL(this.addWord(this.hl(), this.bc()));
    this.cycles += 11;
    break;
  case 0x0A: // LD   A,(BC)
    this.a = this.memio.rd(this.bc());
    this.cycles += 7;
    break;
  case 0x0B: // DEC  BC
    this.BC((this.bc() - 1) & 0xFFFF);
    this.cycles += 6;
    break;
  case 0x0C: // INC  C
    this.c = this.incrementByte(this.c);
    this.cycles += 5;
    break;
  case 0x0D: // DEC  C
    this.c = this.decrementByte(this.c);
    this.cycles += 5;
    break;
  case 0x0E: // LD   C,n
    this.c = this.nextByte();
    this.cycles += 7;
    break;
  case 0x0F:
    {
      // RRCA
      var h = (this.a & 1) << 7;
      if (h)
        this.f |= CARRY;
      else
        this.f &= ~CARRY & 0xFF;

      this.a = ((this.a >> 1) & 0x7F) | h;
      this.cycles += 4;
    }
    break;
  case 0x11: // LD   DE,nn
    this.DE(this.nextWord());
    this.cycles += 10;
    break;
  case 0x12: // LD   (DE),A
    this.writeByte(this.de(), this.a);
    this.cycles += 7;
    break;
  case 0x13: // INC  DE
    this.DE((this.de() + 1) & 0xFFFF);
    this.cycles += 6;
    break;
  case 0x14: // INC  D
    this.d = this.incrementByte(this.d);
    this.cycles += 5;
    break;
  case 0x15: // DEC  D
    this.d = this.decrementByte(this.d);
    this.cycles += 5;
    break;
  case 0x16: // LD   D,n
    this.d = this.nextByte();
    this.cycles += 7;
    break;
  case 0x17:
    {
      // RLA
      var c = (this.f & CARRY) ? 1 : 0;
      if(this.a & 0x80)
        this.f |= CARRY;
      else
        this.f &= ~CARRY & 0xFF;
      this.a = ((this.a << 1) & 0xFE) | c;
      this.cycles += 4;
    }
    break;
  case 0x19: // ADD  HL,DE
    this.HL(this.addWord(this.hl(), this.de()));
    this.cycles += 11;
    break;
  case 0x1A: // LD   A,(DE)
    this.a = this.memio.rd(this.de());
    this.cycles += 7;
    break;
  case 0x1B: // DEC  DE
    this.DE((this.de() - 1) & 0xFFFF);
    this.cycles += 6;
    break;
  case 0x1C: // INC  E
    this.e = this.incrementByte(this.e);
    this.cycles += 5;
    break;
  case 0x1D: // DEC  E
    this.e = this.decrementByte(this.e);
    this.cycles += 5;
    break;
  case 0x1E: // LD   E,n
    this.e = this.nextByte();
    this.cycles += 7;
    break;
  case 0x1F:
    {
      // RRA
      var c = (this.f & CARRY) ? 0x80 : 0;
      if(this.a & 1)
        this.f |= CARRY;
      else
        this.f &= ~CARRY & 0xFF;
      this.a = ((this.a >> 1) & 0x7F) | c;
      this.cycles += 4;
    }
    break;
  case 0x21: // LD   HL,nn
    this.HL(this.nextWord());
    this.cycles += 10;
    break;
  case 0x22: // LD   (nn),HL
    this.writeWord(this.nextWord(), this.hl());
    this.cycles += 16;
    break;
  case 0x23: // INC  HL
    this.HL((this.hl() + 1) & 0xFFFF);
    this.cycles += 6;
    break;
  case 0x24: // INC  H
    this.h = this.incrementByte(this.h);
    this.cycles += 5;
    break;
  case 0x25: // DEC  H
    this.h = this.decrementByte(this.h);
    this.cycles += 5;
    break;
  case 0x26: // LD   H,n
    this.h = this.nextByte();
    this.cycles += 7;
    break;
  case 0x27:
    {
      // DAA
      var p1 = ((this.f & HALFCARRY) || (this.a & 0x0f) > 9) ? 6 : 0;
      this.a = this.calcFlags(this.a+p1, this.a, p1);
      var p3 = ((this.f & CARRY) || (this.a & 0xf0) > 0x90) ? 0x60 : 0;
      this.a = this.calcFlags(this.a+p3, this.a, p3);
      this.cycles += 4;
    }
    break;
  case 0x29: // ADD  HL,HL
    this.HL(this.addWord(this.hl(), this.hl()));
    this.cycles += 11;
    break;
  case 0x2A: // LD   HL,(nn)
    this.HL(this.getWord(this.nextWord()));
    this.cycles += 16;
    break;
  case 0x2B: // DEC  HL
    this.HL((this.hl() - 1) & 0xFFFF);
    this.cycles += 6;
    break;
  case 0x2C: // INC  L
    this.l = this.incrementByte(this.l);
    this.cycles += 5;
    break;
  case 0x2D: // DEC  L
    this.l = this.decrementByte(this.l);
    this.cycles += 5;
    break;
  case 0x2E: // LD   L,n
    this.l = this.nextByte();
    this.cycles += 7;
    break;
  case 0x2F: // CPL
    this.a ^= 0xFF;
    this.cycles += 4;
    break;
  case 0x31: // LD   SP,nn
    this.sp = this.nextWord();
    this.cycles += 10;
    break;
  case 0x32: // LD   (nn),A
    this.writeByte(this.nextWord(), this.a);
    this.cycles += 13;
    break;
  case 0x33: // INC  SP
    this.sp = ((this.sp + 1) & 0xFFFF);
    this.cycles += 6;
    break;
  case 0x34:
    {
      // INC  (HL)
      var addr = this.hl();
      this.writeByte(addr, this.incrementByte(this.memio.rd(addr)));
      this.cycles += 10;
    }
    break;
  case 0x35:
    {
      // DEC  (HL)
      var addr = this.hl();
      this.writeByte(addr, this.decrementByte(this.memio.rd(addr)));
      this.cycles += 10;
    }
    break;
  case 0x36: // LD   (HL),n
    this.writeByte(this.hl(), this.nextByte());
    this.cycles += 10;
    break;
  case 0x37: // SCF
    this.f |= CARRY;
    this.cycles += 4;
    break;
  case 0x39: // ADD  HL,SP
    this.HL(this.addWord(this.hl(), this.sp));
    this.cycles += 11;
    break;
  case 0x3A: // LD   A,(nn)
    this.a = this.memio.rd(this.nextWord());
    this.cycles += 13;
    break;
  case 0x3B: // DEC  SP
    this.sp = (this.sp - 1) & 0xFFFF;
    this.cycles += 6;
    break;
  case 0x3C: // INC  A
    this.a = this.incrementByte(this.a);
    this.cycles += 5;
    break;
  case 0x3D: // DEC  A
    this.a = this.decrementByte(this.a);
    this.cycles += 5;
    break;
  case 0x3E: // LD   A,n
    this.a = this.nextByte();
    this.cycles += 7;
    break;
  case 0x3F: // CCF
    this.f ^= CARRY; //~CARRY & 0xFF;
    this.cycles += 4;
    break;









  case 0xC0:
    {
      //  RET  NZ      ; opcode C0 cycles 05
      if (this.f & ZERO)
        this.cycles += 5;
      else {
        this.pc = this.pop();
        this.cycles += 11;
      }
    }
    break;
  case 0xC1:
    {
      //  POP  BC
      this.BC(this.pop());
      this.cycles += 10;
    }
    break;
  case 0xC2:
    {
      // JP   NZ,nn
      if (this.f & ZERO) {
        this.pc = (this.pc + 2) & 0xFFFF;
      }
      else {
        this.pc = this.nextWord();
      }
      this.cycles += 10;
    }
    break;
  case 0xC3:
    {
      //  JP   nn
      this.pc = this.getWord(this.pc);
      this.cycles += 10;
    }
    break;
  case 0xC4:
    {
      //  CALL NZ,nn
      if (this.f & ZERO) {
        this.cycles += 11;
        this.pc = (this.pc + 2) & 0xFFFF;
      }
      else {
        this.cycles += 17;
        var w = this.nextWord();
        this.push(this.pc);
        this.pc = w;
      }
    }
    break;
  case 0xC5:
    {
      //  PUSH BC
      this.push(this.bc());
      this.cycles += 11;
    }
    break;
  case 0xC6:
    {
      //  ADD  A,n
      this.a = this.addByte(this.a, this.nextByte());
      this.cycles += 7;
    }
    break;
  case 0xC7:
    {
      // RST  0
      this.push(this.pc);
      this.pc = 0;
      this.cycles += 11;
    }
    break;
  case 0xC8:
    {
      // RET Z
      if (this.f & ZERO) {
        this.pc = this.pop();
        this.cycles += 11;
      }
      else {
        this.cycles += 5;
      }
    }
    break;
  case 0xC9:
    {
      // RET  nn
      this.pc = this.pop();
      this.cycles += 10;
    }
    break;
  case 0xCA:
    {
      // JP   Z,nn
      if (this.f & ZERO) {
        this.pc = this.nextWord();
      }
      else {
        this.pc = (this.pc + 2) & 0xFFFF;
      }
      this.cycles += 10;
    }
    break;
  case 0xCC:
    {
      //  CALL Z,nn
      if (this.f & ZERO) {
        this.cycles += 17;
        var w = this.nextWord();
        this.push(this.pc);
        this.pc = w;
      }
      else {
        this.cycles += 11;
        this.pc = (this.pc + 2) & 0xFFFF;
      }
    }
    break;
  case 0xCD:
    {
      // CALL nn
      var w = this.nextWord();
      this.push(this.pc);
      this.pc = w;
      this.cycles += 17;
    }
    break;
  case 0xCE:
    {
      // ADC  A,n
      this.a = this.addByteWithCarry(this.a, this.nextByte());
      this.cycles += 7;
    }
    break;
  case 0xCF:
    {
      // RST  8
      this.push(this.pc);
      this.pc = 0x08;
      this.cycles += 11;
    }
    break;
  case 0xD0:
    {
      // RET NC
      if (this.f & CARRY) {
        this.cycles += 5;
      }
      else {
        this.pc = this.pop();
        this.cycles += 11;
      }
    }
    break;
  case 0xD1:
    {
      // POP DE
      this.DE(this.pop());
      this.cycles += 10;
    }
    break;
  case 0xD2:
    {
      // JP   NC,nn
      if (this.f & CARRY) {
        this.pc = (this.pc + 2) & 0xFFFF;
      }
      else {
        this.pc = this.nextWord();
      }
      this.cycles += 10;
    }
    break;
  case 0xD3:
    {
      // OUT  (n),A
      this.writePort(this.nextByte(), this.a);
      this.cycles += 10;
    }
    break;
  case 0xD4:
    {
      //  CALL NC,nn
      if (this.f & CARRY) {
        this.cycles += 11;
        this.pc = (this.pc + 2) & 0xFFFF;
      }
      else {
        this.cycles += 17;
        var w = this.nextWord();
        this.push(this.pc);
        this.pc = w;
      }
    }
    break;
  case 0xD5:
    {
      //  PUSH DE
      this.push(this.de());
      this.cycles += 11;
    }
    break;
  case 0xD6:
    {
      // SUB  n
      this.a = this.subtractByte(this.a, this.nextByte());
      this.cycles += 7;
    }
    break;
  case 0xD7:
    {
      // RST  10H
      this.push(this.pc);
      this.pc = 0x10;
      this.cycles += 11;
    }
    break;
  case 0xD8:
    {
      // RET C
      if (this.f & CARRY) {
        this.pc = this.pop();
        this.cycles += 11;
      }
      else {
        this.cycles += 5;
      }
    }
    break;
  case 0xDA:
    {
      // JP   C,nn
      if (this.f & CARRY) {
        this.pc = this.nextWord();
      }
      else {
        this.pc = (this.pc + 2) & 0xFFFF;
      }
      this.cycles += 10;
    }
    break;
  case 0xDB:
    {
      // IN   A,(n)
      this.a = this.readPort(this.nextByte());
      this.cycles += 10;
    }
    break;
  case 0xDC:
    {
      //  CALL C,nn
      if (this.f & CARRY) {
        this.cycles += 17;
        var w = this.nextWord();
        this.push(this.pc);
        this.pc = w;
      }
      else {
        this.cycles += 11;
        this.pc = (this.pc + 2) & 0xFFFF;
      }
    }
    break;
  case 0xDE:
    {
      // SBC  A,n
      this.a = this.subtractByteWithCarry(this.a, this.nextByte());
      this.cycles += 7;
    }
    break;
  case 0xDF:
    {
      // RST  18H
      this.push(this.pc);
      this.pc = 0x18;
      this.cycles += 11;
    }
    break;
  case 0xE0:
    {
      // RET PO
      if (this.f & PARITY) {
        this.cycles += 5;
      }
      else {
        this.pc = this.pop();
        this.cycles += 11;
      }
    }
    break;
  case 0xE1:
    {
      // POP HL
      this.HL(this.pop());
      this.cycles += 10;
    }
    break;
  case 0xE2:
    {
      // JP   PO,nn
      if (this.f & PARITY) {
        this.pc = (this.pc + 2) & 0xFFFF;
      }
      else {
        this.pc = this.nextWord();
      }
      this.cycles += 10;
    }
    break;
  case 0xE3:
    {
      // EX   (SP),HL ;
      var a = this.getWord(this.sp);
      this.writeWord(this.sp, this.hl());
      this.HL(a);
      this.cycles += 4;
    }
    break;
  case 0xE4:
    {
      //  CALL PO,nn
      if (this.f & PARITY) {
        this.cycles += 11;
        this.pc = (this.pc + 2) & 0xFFFF;
      }
      else {
        this.cycles += 17;
        var w = this.nextWord();
        this.push(this.pc);
        this.pc = w;
      }
    }
    break;
  case 0xE5:
    {
      //  PUSH HL
      this.push(this.hl());
      this.cycles += 11;
    }
    break;
  case 0xE6:
    {
      // AND  n
      this.a = this.andByte(this.a, this.nextByte());
      this.cycles += 7;
    }
    break;
  case 0xE7:
    {
      // RST  20H
      this.push(this.pc);
      this.pc = 0x20;
      this.cycles += 11;
    }
    break;
  case 0xE8:
    {
      // RET PE
      if (this.f & PARITY) {
        this.pc = this.pop();
        this.cycles += 11;
      }
      else {
        this.cycles += 5;
      }
    }
    break;
  case 0xE9:
    {
      // JP   (HL)
      this.pc = this.hl();
      this.cycles += 4;
    }
    break;
  case 0xEA:
    {
      // JP   PE,nn
      if (this.f & PARITY) {
        this.pc = this.nextWord();
      }
      else {
        this.pc = (this.pc + 2) & 0xFFFF;
      }
      this.cycles += 10;
    }
    break;
  case 0xEB:
    {
      // EX   DE,HL
      var a = this.de();
      this.DE(this.hl());
      this.HL(a);
      this.cycles += 4;
    }
    break;
  case 0xEC:
    {
      //  CALL PE,nn
      if (this.f & PARITY) {
        this.cycles += 17;
        var w = this.nextWord();
        this.push(this.pc);
        this.pc = w;
      }
      else {
        this.cycles += 11;
        this.pc = (this.pc + 2) & 0xFFFF;
      }
    }
    break;
  case 0xEE:
    {
      // XOR  n
      this.a = this.xorByte(this.a, this.nextByte());
      this.cycles += 7;
    }
    break;
  case 0xEF:
    {
      // RST  28H
      this.push(this.pc);
      this.pc = 0x28;
      this.cycles += 11;
    }
    break;
  case 0xF0:
    {
      // RET P
      if (this.f & SIGN) {
        this.cycles += 5;
      }
      else {
        this.pc = this.pop();
        this.cycles += 11;
      }
    }
    break;
  case 0xF1:
    {
      // POP AF
      this.AF(this.pop());
      this.cycles += 10;
    }
    break;
  case 0xF2:
    {
      // JP   P,nn
      if (this.f & SIGN) {
        this.pc = (this.pc + 2) & 0xFFFF;
      }
      else {
        this.pc = this.nextWord();
      }
      this.cycles += 10;
    }
    break;
  case 0xF3:
    {
      // DI
      this.f &= ~INTERRUPT & 0xFF;
      this.cycles += 4;
    }
    break;
  case 0xF4:
      {
      //  CALL P,nn
      if (this.f & SIGN) {
        this.cycles += 11;
        this.pc = (this.pc + 2) & 0xFFFF;
      }
      else {
        this.cycles += 17;
        var w = this.nextWord();
        this.push(this.pc);
        this.pc = w;
      }
    }
    break;
  case 0xF5:
    {
      //  PUSH AF
      this.push(this.af());
      this.cycles += 11;
    }
    break;
  case 0xF6:
    {
      // OR   n
      this.a = this.orByte(this.a, this.nextByte());
      this.cycles += 7;
    }
    break;
  case 0xF7:
    {
      // RST  30H
      this.push(this.pc);
      this.pc = 0x30;
      this.cycles += 11;
    }
    break;
  case 0xF8:
    {
      // RET M
      if (this.f & SIGN) {
        this.pc = this.pop();
        this.cycles += 11;
      }
      else {
        this.cycles += 5;
      }
    }
    break;
  case 0xF9:
    {
      // LD   SP,HL
      this.sp = this.hl();
      this.cycles += 6;
    }
    break;
  case 0xFA:
    {
      // JP   M,nn
      if (this.f & SIGN) {
        this.pc = this.nextWord();
      }
      else {
        this.pc = (this.pc + 2) & 0xFFFF;
      }
      this.cycles += 10;
    }
    break;
  case 0xFB:
    {
      // EI
      this.f |= INTERRUPT;
      this.cycles += 4;
    }
    break;
  case 0xFC:
    {
      //  CALL M,nn
      if (this.f & SIGN) {
        this.cycles += 17;
        var w = this.nextWord();
        this.push(this.pc);
        this.pc = w;
      }
      else {
        this.cycles += 11;
        this.pc = (this.pc + 2) & 0xFFFF;
      }
    }
    break;
  case 0xFE:
    {
      // CP   n
      this.subtractByte(this.a, this.nextByte());
      this.cycles += 7;
    }
    break;
  case 0xFF:
    {
      // RST  38H
      this.push(this.pc);
      this.pc = 0x38;
      this.cycles += 11;
    }
    break;
  default:
    {
      // illegal
      this.cycles += 4;
      return false; // illegal, stop execution
    }
    break;

  }
  return true; // go-on
};

Cpu.prototype.setRegisters = function(r) {
  var s = "";
  for (var i=1; i < r.length; i+=2) {
    var reg = r[i].toLowerCase();
    var n = parseInt(r[i+1], 16);
    //s += " " + reg +"="+ n;
    switch (reg) {
    case 'a':
      this.a = n & 0xFF;
      break;
    case 'b':
      this.b = n & 0xFF;
      break;
    case 'c':
      this.c = n & 0xFF;
      break;
    case 'd':
      this.d = n & 0xFF;
      break;
    case 'e':
      this.e = n & 0xFF;
      break;
    case 'h':
      this.h = n & 0xFF;
      break;
    case 'l':
      this.l = n & 0xFF;
      break;
    case 'f':
      this.f = n & 0xFF;
      break;
    case 'fc':
      if (n&1) {this.set(CARRY)} else {this.clear(CARRY)};
      break;
    case 'fp':
      if (n&1) {this.set(PARITY)} else {this.clear(PARITY)};
      break;
    case 'fh':
      if (n&1) {this.set(HALFCARRY)} else {this.clear(HALFCARRY)};
      break;
    case 'fi':
      if (n&1) {this.set(INTERRUPT)} else {this.clear(INTERRUPT)};
      break;
    case 'fz':
      if (n&1) {this.set(ZERO)} else {this.clear(ZERO)};
      break;
    case 'fs':
      if (n&1) {this.set(SIGN)} else {this.clear(SIGN)};
      break;
    case 'af':
      this.AF(n);
      break
    case 'bc':
      this.BC(n);
      break
    case 'de':
      this.DE(n);
      break
    case 'hl':
      this.HL(n);
      break
    case 'sp':
      this.sp = n & 0xFFFF;
      break;
    case 'pc':
      this.pc = n & 0xFFFF;
      break;
    default:
      s += " unknown register " + reg;
    }
  }
  if (s) s+='\r\n';
  return s;
};



// vim: set shiftwidth=2 :
//











Cpu.prototype.run_command = function(cmd) {
    let op = (cmd >> 6) & 3
    switch (op) {
    case 0:
        break
    case 1:
        return this.LOAD(cmd)
    case 2:
        return this.ALU(cmd)
    case 3:
        break
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

    /*
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

*/
