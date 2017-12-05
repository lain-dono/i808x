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







  case 0x40:
    {
      // LD   B,B
      this.b = this.b;
      this.cycles += 5;
    }
    break;
  case 0x41:
    {
      //LD   B,C
      this.b = this.c;
      this.cycles += 5;
    }
    break;
  case 0x42:
    {
      // LD   B,D
      this.b = this.d;
      this.cycles += 5;
    }
    break;
  case 0x43:
    {
      // LD   B,E
      this.b = this.e;
      this.cycles += 5;
    }
    break;
  case 0x44:
    {
      // LD   B,H
      this.b = this.h;
      this.cycles += 5;
    }
    break;
  case 0x45:
    {
      // LD   B,L
      this.b = this.l;
      this.cycles += 5;
    }
    break;
  case 0x46:
    {
      // LD   B,(HL)
      this.b = this.memio.rd(this.hl());
      this.cycles += 7;
    }
    break;
  case 0x47:
    {
      // LD   B,A
      this.b = this.a;
      this.cycles += 5;
    }
    break;
  case 0x48:
    {
      // LD   C,B
      this.c = this.b;
      this.cycles += 5;
    }
    break;
  case 0x49:
    {
      // LD   C,C
      this.c = this.c;
      this.cycles += 5;
    }
    break;
  case 0x4A:
    {
      // LD   C,D
      this.c = this.d;
      this.cycles += 5;
    }
    break;
  case 0x4B:
    {
      // LD   C,E
      this.c = this.e;
      this.cycles += 5;
    }
    break;
  case 0x4C:
    {
      // LD   C,H
      this.c = this.h;
      this.cycles += 5;
    }
    break;
  case 0x4D:
    {
      // LD   C,L
      this.c = this.l;
      this.cycles += 5;
    }
    break;
  case 0x4E:
    {
      // LD   C,(HL)
      this.c = this.memio.rd(this.hl());
      this.cycles += 7;
    }
    break;
  case 0x4F:
    {
      // LD   C,A
      this.c = this.a;
      this.cycles += 5;
    }
    break;
  case 0x50:
    {
      // LD   D,B
      this.d = this.b;
      this.cycles += 5;
    }
    break;
  case 0x51:
    {
      // LD   D,C
      this.d = this.c;
      this.cycles += 5;
    }
    break;
  case 0x52:
    {
      // LD   D,D
      this.d = this.d;
      this.cycles += 5;
    }
    break;
  case 0x53:
    {
      // LD   D,E
      this.d = this.e;
      this.cycles += 5;
    }
    break;
  case 0x54:
    {
      // LD   D,H
      this.d = this.h;
      this.cycles += 5;
    }
    break;
  case 0x55:
    {
      // LD   D,L
      this.d = this.l;
      this.cycles += 5;
    }
    break;
  case 0x56:
    {
      // LD   D,(HL)
      this.d = this.memio.rd(this.hl());
      this.cycles += 7;
    }
    break;
  case 0x57:
    {
      // LD   D,A
      this.d = this.a;
      this.cycles += 5;
    }
    break;
  case 0x58:
    {
      // LD   E,B
      this.e = this.b;
      this.cycles += 5;
    }
    break;
  case 0x59:
    {
      // LD   E,C
      this.e = this.c;
      this.cycles += 5;
    }
    break;
  case 0x5A:
    {
      // LD   E,D
      this.e = this.d;
      this.cycles += 5;
    }
    break;
  case 0x5B:
    {
      // LD   E,E
      this.e = this.e;
      this.cycles += 5;
    }
    break;
  case 0x5C:
    {
      // LD   E,H
      this.e = this.h;
      this.cycles += 5;
    }
    break;
  case 0x5D:
    {
      // LD   E,L
      this.e = this.l;
      this.cycles += 5;
    }
    break;
  case 0x5E:
    {
      // LD   E,(HL)
      this.e = this.memio.rd(this.hl());
      this.cycles += 7;
    }
    break;
  case 0x5F:
    {
      // LD   E,A
      this.e = this.a;
      this.cycles += 5;
    }
    break;
  case 0x60:
    {
      // LD   H,B
      this.h = this.b;
      this.cycles += 5;
    }
    break;
  case 0x61:
    {
      // LD   H,C
      this.h = this.c;
      this.cycles += 5;
    }
    break;
  case 0x62:
    {
      // LD   H,D
      this.h = this.d;
      this.cycles += 5;
    }
    break;
  case 0x63:
    {
      // LD   H,E
      this.h = this.e;
      this.cycles += 5;
    }
    break;
  case 0x64:
    {
      // LD   H,H
      this.h = this.h;
      this.cycles += 5;
    }
    break;
  case 0x65:
    {
      // LD   H,L
      this.h = this.l;
      this.cycles += 5;
    }
    break;
  case 0x66:
    {
      // LD   H,(HL)
      this.h = this.memio.rd(this.hl());
      this.cycles += 7;
    }
    break;
  case 0x67:
    {
      // LD   H,A
      this.h = this.a;
      this.cycles += 5;
    }
    break;
  case 0x68:
    {
      // LD   L,B
      this.l = this.b;
      this.cycles += 5;
    }
    break;
  case 0x69:
    {
      // LD   L,C
      this.l = this.c;
      this.cycles += 5;
    }
    break;
  case 0x6A:
    {
      // LD   L,D
      this.l = this.d;
      this.cycles += 5;
    }
    break;
  case 0x6B:
    {
      // LD   L,E
      this.l = this.e;
      this.cycles += 5;
    }
    break;
  case 0x6C:
    {
      // LD   L,H
      this.l = this.h;
      this.cycles += 5;
    }
    break;
  case 0x6D:
    {
      // LD   L,L
      this.l = this.l;
      this.cycles += 5;
    }
    break;
  case 0x6E:
  {
      // LD   L,(HL)
      this.l = this.memio.rd(this.hl());
      this.cycles += 7;
  }
  break;
  case 0x6F:
    {
      // LD   L,A
      this.l = this.a;
      this.cycles += 5;
    }
    break;

  case 0x70:
    {
      // LD   (HL),B
      this.writeByte(this.hl(), this.b);
      this.cycles += 7;
    }
    break;
  case 0x71:
    {
      // LD   (HL),C
      this.writeByte(this.hl(), this.c);
      this.cycles += 7;
    }
    break;
  case 0x72:
    {
      // LD   (HL),D
      this.writeByte(this.hl(), this.d);
      this.cycles += 7;
    }
    break;
  case 0x73:
    {
      // LD   (HL),E
      this.writeByte(this.hl(), this.e);
      this.cycles += 7;
    }
    break;
  case 0x74:
    {
      // LD   (HL),H
      this.writeByte(this.hl(), this.h);
      this.cycles += 7;
    }
    break;
  case 0x75:
    {
      // LD   (HL),L
      this.writeByte(this.hl(), this.l);
      this.cycles += 7;
    }
    break;
  case 0x76:
    {
      // HALT
      this.cycles += 7;
      return false; // stop emulation
    }
    break;
  case 0x77:
    {
      // LD   (HL),A
      this.writeByte(this.hl(), this.a);
      this.cycles += 7;
    }
    break;
  case 0x78:
    {
      // LD   A,B
      this.a = this.b;
      this.cycles += 5;
    }
    break;
  case 0x79:
    {
      // LD   A,C
      this.a = this.c;
      this.cycles += 5;
    }
    break;
  case 0x7A:
    {
      // LD   A,D
      this.a = this.d;
      this.cycles += 5;
    }
    break;
  case 0x7B:
    {
      // LD   A,E
      this.a = this.e;
      this.cycles += 5;
    }
    break;
  case 0x7C:
    {
      // LD   A,H
      this.a = this.h;
      this.cycles += 5;
    }
    break;
  case 0x7D:
    {
      // LD   A,L
      this.a = this.l;
      this.cycles += 5;
    }
    break;
  case 0x7E:
    {
      // LD   A,(HL)
      this.a = this.memio.rd(this.hl());
      this.cycles += 7;
    }
    break;
  case 0x7F:
    {
      // LD   A,A
      this.a = this.a;
      this.cycles += 5;
    }
    break;






  case 0x80: // ADD  A,B
    this.a = this.addByte(this.a, this.b);
    this.cycles += 4;
    break;
  case 0x81: // ADD  A,C
    this.a = this.addByte(this.a, this.c);
    this.cycles += 4;
    break;
  case 0x82: // ADD  A,D
    this.a = this.addByte(this.a, this.d);
    this.cycles += 4;
    break;
  case 0x83:
    {
      // ADD  A,E
      this.a = this.addByte(this.a, this.e);
      this.cycles += 4;
    }
    break;
  case 0x84:
    {
      // ADD  A,H
      this.a = this.addByte(this.a, this.h);
      this.cycles += 4;
    }
    break;
  case 0x85:
    {
      // ADD  A,L
      this.a = this.addByte(this.a, this.l);
      this.cycles += 4;
    }
    break;
  case 0x86:
    {
      // ADD  A,(HL)
      this.a = this.addByte(this.a, this.memio.rd(this.hl()));
      this.cycles += 7;
    }
    break;
  case 0x87:
    {
      // ADD  A,A
      this.a = this.addByte(this.a, this.a);
      this.cycles += 4;
    }
    break;
  case 0x88:
    {
      // ADC  A,B
      this.a = this.addByteWithCarry(this.a, this.b);
      this.cycles += 4;
    }
    break;
    case 0x89:
      {
      // ADC  A,C
      this.a = this.addByteWithCarry(this.a, this.c);
      this.cycles += 4;
    }
    break;
  case 0x8A:
    {
      // ADC  A,D
      this.a = this.addByteWithCarry(this.a, this.d);
      this.cycles += 4;
    }
    break;
    case 0x8B:
      {
      // ADC  A,E
      this.a = this.addByteWithCarry(this.a, this.e);
      this.cycles += 4;
    }
    break;
  case 0x8C:
    {
      // ADC  A,H
      this.a = this.addByteWithCarry(this.a, this.h);
      this.cycles += 4;
    }
    break;
  case 0x8D:
    {
      // ADC  A,L
      this.a = this.addByteWithCarry(this.a, this.l);
      this.cycles += 4;
    }
    break;
  case 0x8E:
    {
      // ADC  A,(HL)
      this.a = this.addByteWithCarry(this.a, this.memio.rd(this.hl()));
      this.cycles += 7;
    }
    break;
  case 0x8F:
    {
      // ADC  A,A
      this.a = this.addByteWithCarry(this.a, this.a);
      this.cycles += 4;
    }
    break;
  case 0x90:
    {
      // SUB  B
      this.a = this.subtractByte(this.a, this.b);
      this.cycles += 4;
    }
    break;
  case 0x91:
    {
      // SUB  C
      this.a = this.subtractByte(this.a, this.c);
      this.cycles += 4;
    }
    break;
  case 0x92:
    {
      // SUB  D
      this.a = this.subtractByte(this.a, this.d);
      this.cycles += 4;
    }
    break;
  case 0x93:
    {
      // SUB  E
      this.a = this.subtractByte(this.a, this.e);
      this.cycles += 4;
    }
    break;
  case 0x94:
    {
      // SUB  H
      this.a = this.subtractByte(this.a, this.h);
      this.cycles += 4;
    }
    break;
  case 0x95:
    {
      // SUB  L
      this.a = this.subtractByte(this.a, this.l);
      this.cycles += 4;
    }
    break;
  case 0x96:
    {
      // SUB  (HL)
      this.a = this.subtractByte(this.a, this.memio.rd(this.hl()));
      this.cycles += 7;
    }
    break;
  case 0x97:
    {
      // SUB  A
      this.a = this.subtractByte(this.a, this.a);
      this.cycles += 4;
    }
    break;
  case 0x98:
    {
      // SBC  A,B
      this.a = this.subtractByteWithCarry(this.a, this.b);
      this.cycles += 4;
    }
    break;
  case 0x99:
    {
      // SBC  A,C
      this.a = this.subtractByteWithCarry(this.a, this.c);
      this.cycles += 4;
    }
    break;
  case 0x9A:
    {
      // SBC  A,D
      this.a = this.subtractByteWithCarry(this.a, this.d);
      this.cycles += 4;
    }
    break;
  case 0x9B:
    {
      // SBC  A,E
      this.a = this.subtractByteWithCarry(this.a, this.e);
      this.cycles += 4;
    }
    break;
  case 0x9C:
    {
      // SBC  A,H
      this.a = this.subtractByteWithCarry(this.a, this.h);
      this.cycles += 4;
    }
    break;
  case 0x9D:
    {
      // SBC  A,L
      this.a = this.subtractByteWithCarry(this.a, this.l);
      this.cycles += 4;
    }
    break;
  case 0x9E:
    {
      //  SBC  A,(HL)
      this.a = this.subtractByteWithCarry(this.a, this.memio.rd(this.hl()));
      this.cycles += 7;
    }
    break;
  case 0x9F:
    {
      // SBC  A,A
      this.a = this.subtractByteWithCarry(this.a, this.a);
      this.cycles += 4;
    }
    break;
  case 0xA0:
    {
      // AND  B
      this.a = this.andByte(this.a, this.b);
      this.cycles += 4;
    }
    break;
  case 0xA1:
    {
      // AND  C
      this.a = this.andByte(this.a, this.c);
      this.cycles += 4;
    }
    break;
  case 0xA2:
    {
      // AND  D
      this.a = this.andByte(this.a, this.d);
      this.cycles += 4;
    }
    break;
  case 0xA3:
    {
      // AND  E
      this.a = this.andByte(this.a, this.e);
      this.cycles += 4;
    }
    break;
  case 0xA4:
    {
      // AND  H
      this.a = this.andByte(this.a, this.h);
      this.cycles += 4;
    }
    break;
  case 0xA5:
    {
      // AND  L
      this.a = this.andByte(this.a, this.l);
      this.cycles += 4;
    }
    break;
  case 0xA6:
    {
      // AND  (HL)
      this.a = this.andByte(this.a, this.memio.rd(this.hl()));
      this.cycles += 7;
    }
    break;
  case 0xA7:
    {
      // AND  A
      this.a = this.andByte(this.a, this.a);
      this.cycles += 4;
    }
    break;
  case 0xA8:
    {
      // XOR  B
      this.a = this.xorByte(this.a, this.b);
      this.cycles += 4;
    }
    break;
  case 0xA9:
    {
      // XOR  C
      this.a = this.xorByte(this.a, this.c);
      this.cycles += 4;
    }
    break;
  case 0xAA:
    {
      // XOR  D
      this.a = this.xorByte(this.a, this.d);
      this.cycles += 4;
    }
    break;
  case 0xAB:
    {
      // XOR  E
      this.a = this.xorByte(this.a, this.e);
      this.cycles += 4;
    }
    break;
  case 0xAC:
    {
      // XOR  H
      this.a = this.xorByte(this.a, this.h);
      this.cycles += 4;
    }
    break;
  case 0xAD:
    {
      // XOR  L
      this.a = this.xorByte(this.a, this.l);
      this.cycles += 4;
    }
    break;
  case 0xAE:
    {
      // XOR  (HL)
      this.a = this.xorByte(this.a, this.memio.rd(this.hl()));
      this.cycles += 7;
    }
    break;
  case 0xAF:
    {
      // XOR  A
      this.a = this.xorByte(this.a, this.a);
      this.cycles += 4;
    }
    break;
  case 0xB0:
    {
      // OR  B
      this.a = this.orByte(this.a, this.b);
      this.cycles += 4;
    }
    break;
  case 0xB1:
    {
      // OR  C
      this.a = this.orByte(this.a, this.c);
      this.cycles += 4;
    }
    break;
  case 0xB2:
    {
      // OR  D
      this.a = this.orByte(this.a, this.d);
      this.cycles += 4;
    }
    break;
  case 0xB3:
    {
      // OR  E
      this.a = this.orByte(this.a, this.e);
      this.cycles += 4;
    }
    break;
  case 0xB4:
    {
      // OR  H
      this.a = this.orByte(this.a, this.h);
      this.cycles += 4;
    }
    break;
  case 0xB5:
    {
      // OR  L
      this.a = this.orByte(this.a, this.l);
      this.cycles += 4;
    }
    break;
  case 0xB6:
    {
      //  OR   (HL)
      this.a = this.orByte(this.a, this.memio.rd(this.hl()));
      this.cycles += 7;
    }
    break;
  case 0xB7:
    {
      // OR  A
      this.a = this.orByte(this.a, this.a);
      this.cycles += 4;
    }
    break;
  case 0xB8:
    {
      //  CP   B
      this.subtractByte(this.a, this.b);
      this.cycles += 4;
    }
    break;
  case 0xB9:
    {
      //  CP   C
      this.subtractByte(this.a, this.c);
      this.cycles += 4;
    }
    break;
  case 0xBA:
    {
      //  CP   D
      this.subtractByte(this.a, this.d);
      this.cycles += 4;
    }
    break;
  case 0xBB:
    {
      //  CP   E
      this.subtractByte(this.a, this.e);
      this.cycles += 4;
    }
    break;
  case 0xBC:
    {
      //  CP   H
      this.subtractByte(this.a, this.h);
      this.cycles += 4;
    }
    break;
  case 0xBD:
    {
      //  CP   L
      this.subtractByte(this.a, this.l);
      this.cycles += 4;
    }
    break;
  case 0xBE:
    {
      // CP   (HL)
      this.subtractByte(this.a, this.memio.rd(this.hl()));
      this.cycles += 7;
    }
    break;
  case 0xBF:
    {
      //  CP   A
      this.subtractByte(this.a, this.a);
      this.cycles += 4;
    }
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


// disassembler accesses RAM directly
//   just for the case of memory mapped IO, not to trigger IO!
Cpu.prototype.disassembleInstruction = function(addr) {
  var i = this.ram[addr];

  switch(i) {
  case 0x00:
    {
      // NOP
      var r = "NOP";
      return [addr+1, r];
    }
    break;
  case 0x01:
    {
      // LD BC,nn
      var r = "LD BC," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0x02:
    {
      // LD (BC),A
      var r = "LD (BC),A";
      return [addr+1, r];
    }
    break;
  case 0x03:
    {
      // INC BC
      var r = "INC BC";
      return [addr+1, r];
    }
    break;
  case 0x04:
    {
      // INC  B
      var r = "INC B";
      return [addr+1, r];
    }
    break;
  case 0x05:
    {
      // DEC  B
      var r = "DEC B";
      return [addr+1, r];
    }
    break;
  case 0x06:
    {
      // LD   B,n
      var r = "LD B," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0x07:
    {
      // RLCA
      var r = "RLCA";
      return [addr+1, r];
    }
    break;
  case 0x09:
    {
      // ADD  HL,BC
      var r = "ADD HL,BC";
      return [addr+1, r];
    }
    break;
  case 0x0A:
    {
      // LD   A,(BC)
      var r = "LD A,(BC)";
      return [addr+1, r];
    }
    break;
  case 0x0B:
    {
      // DEC  BC
      var r = "DEC BC";
      return [addr+1, r];
  }
    break;
  case 0x0C:
    {
      // INC  C
      var r = "INC C";
      return [addr+1, r];
    }
    break;
  case 0x0D:
    {
      // DEC  C
      var r = "DEC C";
      return [addr+1, r];
    }
    break;
  case 0x0E:
    {
      // LD   C,n
      var r = "LD C," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0x0F:
    {
      // RRCA
      var r = "RRCA";
      return [addr+1, r];
    }
    break;
  case 0x11:
    {
      // LD   DE,nn
      var r = "LD DE," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0x12:
    {
      // LD   (DE),A
      var r = "LD (DE),A";
      return [addr+1, r];
    }
    break;
  case 0x13:
    {
      // INC  DE
      var r = "INC DE";
      return [addr+1, r];
    }
    break;
  case 0x14:
    {
      // INC  D
      var r = "INC D";
      return [addr+1, r];
    }
    break;
  case 0x15:
    {
      // DEC  D
      var r = "DEC D";
      return [addr+1, r];
    }
    break;
  case 0x16:
    {
      // LD   D,n
      var r = "LD D," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0x17:
    {
      // RLA
      var r = "RLA";
      return [addr+1, r];
    }
    break;
  case 0x19:
    {
      // ADD  HL,DE
      var r = "ADD HL,DE";
      return [addr+1, r];
    }
    break;
  case 0x1A:
    {
      // LD   A,(DE)
      var r = "LD A,(DE)";
      return [addr+1, r];
    }
    break;
  case 0x1B:
    {
      // DEC  DE
      var r = "DEC DE";
      return [addr+1, r];
    }
    break;
  case 0x1C:
    {
      // INC  E
      var r = "INC E";
      return [addr+1, r];
    }
    break;
  case 0x1D:
    {
      // DEC  E
      var r = "DEC E";
      return [addr+1, r];
    }
    break;
  case 0x1E:
    {
      // LD   E,n
      var r = "LD E," + this.ram[addr+1];
      return [addr+2, r];
    }
    break;
  case 0x1F:
    {
      // RRA
      var r = "RRA";
      return [addr+1, r];
    }
    break;
  case 0x21:
    {
      // LD   HL,nn
      var r = "LD HL," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0x22:
    {
      // LD   (nn),HL
      var r = "LD (" + this.getWord(addr+1).toString(16) + "),HL";
      return [addr+3, r];
    }
    break;
  case 0x23:
    {
      // INC  HL
      var r = "INC HL";
      return [addr+1, r];
    }
    break;
  case 0x24:
    {
      // INC  H
      var r = "INC H";
      return [addr+1, r];
    }
    break;
  case 0x25:
    {
      // DEC  H
      var r = "DEC H";
      return [addr+1, r];
    }
    break;
  case 0x26:
    {
      // LD   H,n
      var r = "LD H," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0x27:
    {
      // DAA
      var r = "DAA";
      return [addr+1, r];
    }
    break;
  case 0x29:
    {
      // ADD  HL,HL
      var r = "ADD HL,HL";
      return [addr+1, r];
    }
    break;
  case 0x2A:
    {
      // LD   HL,(nn)
      var r = "LD HL,(" + this.getWord(addr+1).toString(16) + ")";
      return [addr+3, r];
    }
    break;
  case 0x2B:
    {
      // DEC  HL
      var r = "DEC HL";
      return [addr+1, r];
    }
    break;
  case 0x2C:
    {
      // INC  L
      var r = "INC L";
      return [addr+1, r];
    }
    break;
  case 0x2D:
    {
      // DEC  L
      var r = "DEC L";
      return [addr+1, r];
    }
    break;
  case 0x2E:
    {
      // LD   L,n
      var r = "LD L," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0x2F:
    {
      // CPL
      var r = "CPL";
      return [addr+1, r];
    }
    break;
  case 0x31:
    {
      // LD   SP,nn
      var r = "LD SP," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0x32:
    {
      // LD   (nn),A
      var r = "LD (" + this.getWord(addr+1).toString(16) + "),A";
      return [addr+3, r];
    }
    break;
  case 0x33:
    {
      // INC  SP
      var r = "INC SP";
      return [addr+1, r];
    }
    break;
  case 0x34:
    {
      // INC  (HL)
      var r = "INC (HL)";
      return [addr+1, r];
    }
    break;
  case 0x35:
    {
      // DEC  (HL)
      var r = "DEC (HL)";
      return [addr+1, r];
    }
    break;
  case 0x36:
    {
      // LD   (HL),n
      var r = "LD (HL)," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0x37:
    {
      // SCF
      var r = "SCF";
      return [addr+1, r];
    }
    break;
  case 0x39:
    {
      // ADD  HL,SP
      var r = "ADD HL,SP";
      return [addr+1, r];
    }
    break;
  case 0x3A:
    {
      // LD   A,(nn)
      var r = "LD A,(" + this.getWord(addr+1).toString(16) + ")";
      return [addr+3, r];
    }
    break;
  case 0x3B:
    {
      // DEC  SP
      var r = "DEC SP";
      return [addr+1, r];
    }
    break;
  case 0x3C:
    {
      // INC  A
      var r = "INC A";
      return [addr+1, r];
    }
    break;
  case 0x3D:
    {
      // DEC  A
      var r = "DEC A";
      return [addr+1, r];
    }
    break;
  case 0x3E:
    {
      // LD   A,n
      var r = "LD A," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0x3F:
    {
      // CCF
      var r = "CCF";
      return [addr+1, r];
    }
    break;
  case 0x40:
    {
      // LD   B,B
      var r = "LD B,B";
      return [addr+1, r];
    }
    break;
  case 0x41:
    {
      //LD   B,C
      var r = "LD B,C";
      return [addr+1, r];
    }
    break;
  case 0x42:
    {
      // LD   B,D
      var r = "LD B,D";
      return [addr+1, r];
    }
    break;
  case 0x43:
    {
      // LD   B,E
      var r = "LD B,E";
      return [addr+1, r];
    }
    break;
  case 0x44:
    {
      // LD   B,H
      var r = "LD B,H";
      return [addr+1, r];
    }
    break;
  case 0x45:
    {
      // LD   B,L
      var r = "LD B,L";
      return [addr+1, r];
    }
    break;
  case 0x46:
    {
      // LD   B,(HL)
      var r = "LD B,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x47:
    {
      // LD   B,A
      var r = "LD B,A";
      return [addr+1, r];
    }
    break;
  case 0x48:
    {
      // LD   C,B
      var r = "LD C,B";
      return [addr+1, r];
    }
    break;
  case 0x49:
    {
      // LD   C,C
      var r = "LD C,C";
      return [addr+1, r];
    }
    break;
  case 0x4A:
    {
      // LD   C,D
      var r = "LD C,D";
      return [addr+1, r];
    }
    break;
  case 0x4B:
    {
      // LD   C,E
      var r = "LD C,E";
      return [addr+1, r];
    }
    break;
  case 0x4C:
    {
      // LD   C,H
      var r = "LD C,H";
      return [addr+1, r];
    }
    break;
  case 0x4D:
    {
      // LD   C,L
      var r = "LD C,L";
      return [addr+1, r];
    }
    break;
  case 0x4E:
    {
      // LD   C,(HL)
      var r = "LD C,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x4F:
    {
      // LD   C,A
      var r = "LD C,A";
      return [addr+1, r];
    }
    break;
  case 0x50:
    {
      // LD   D,B
      var r = "LD D,B";
      return [addr+1, r];
    }
    break;
  case 0x51:
    {
      // LD   D,C
      var r = "LD D,C";
      return [addr+1, r];
    }
    break;
  case 0x52:
    {
      // LD   D,D
      var r = "LD D,D";
      return [addr+1, r];
    }
    break;
  case 0x53:
    {
      // LD   D,E
      var r = "LD D,E";
      return [addr+1, r];
    }
    break;
  case 0x54:
    {
      // LD   D,H
      var r = "LD D,H";
      return [addr+1, r];
    }
    break;
  case 0x55:
    {
      // LD   D,L
      var r = "LD D,L";
      return [addr+1, r];
    }
    break;
  case 0x56:
    {
      // LD   D,(HL)
      var r = "LD D,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x57:
    {
      // LD   D,A
      var r = "LD D,A";
      return [addr+1, r];
    }
    break;
  case 0x58:
    {
      // LD   E,B
      var r = "LD E,B";
      return [addr+1, r];
    }
    break;
  case 0x59:
    {
      // LD   E,C
      var r = "LD E,C";
      return [addr+1, r];
    }
    break;
  case 0x5A:
    {
      // LD   E,D
      var r = "LD E,D";
      return [addr+1, r];
    }
    break;
  case 0x5B:
    {
      // LD   E,E
      var r = "LD E,E";
      return [addr+1, r];
    }
    break;
  case 0x5C:
    {
      // LD   E,H
      var r = "LD E,H";
      return [addr+1, r];
    }
    break;
  case 0x5D:
    {
      // LD   E,L
      var r = "LD E,L";
      return [addr+1, r];
    }
    break;
  case 0x5E:
    {
      // LD   E,(HL)
      var r = "LD E,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x5F:
    {
      // LD   E,A
      var r = "LD E,A";
      return [addr+1, r];
    }
    break;
  case 0x60:
    {
      // LD   H,B
      var r = "LD H,B";
      return [addr+1, r];
    }
    break;
  case 0x61:
    {
      // LD   H,C
      var r = "LD H,C";
      return [addr+1, r];
    }
    break;
  case 0x62:
    {
      // LD   H,D
      var r = "LD H,D";
      return [addr+1, r];
    }
    break;
  case 0x63:
    {
      // LD   H,E
      var r = "LD H,E";
      return [addr+1, r];
    }
    break;
  case 0x64:
    {
      // LD   H,H
      var r = "LD H,H";
      return [addr+1, r];
    }
    break;
  case 0x65:
    {
      // LD   H,L
      var r = "LD H,L";
      return [addr+1, r];
    }
    break;
  case 0x66:
    {
      // LD   H,(HL)
      var r = "LD H,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x67:
    {
      // LD   H,A
      var r = "LD H,A";
      return [addr+1, r];
    }
    break;
  case 0x68:
    {
      // LD   L,B
      var r = "LD L,B";
      return [addr+1, r];
    }
    break;
  case 0x69:
    {
      // LD   L,C
      var r = "LD L,C";
      return [addr+1, r];
    }
    break;
  case 0x6A:
    {
      // LD   L,D
      var r = "LD L,D";
      return [addr+1, r];
    }
    break;
  case 0x6B:
    {
      // LD   L,E
      var r = "LD L,E";
      return [addr+1, r];
    }
    break;
  case 0x6C:
    {
      // LD   L,H
      var r = "LD L,H";
      return [addr+1, r];
    }
    break;
  case 0x6D:
    {
      // LD   L,L
      var r = "LD L,L";
      return [addr+1, r];
    }
    break;
  case 0x6E:
  {
      // LD   L,(HL)
      var r = "LD L,(HL)";
      return [addr+1, r];
  }
  break;
  case 0x6F:
    {
      // LD   L,A
      var r = "LD L,A";
      return [addr+1, r];
    }
    break;

  case 0x70:
    {
      // LD   (HL),B
      var r = "LD (HL),B";
      return [addr+1, r];
    }
    break;
  case 0x71:
    {
      // LD   (HL),C
      var r = "LD (HL),C";
      return [addr+1, r];
    }
    break;
  case 0x72:
    {
      // LD   (HL),D
      var r = "LD (HL),D";
      return [addr+1, r];
    }
    break;
  case 0x73:
    {
      // LD   (HL),E
      var r = "LD (HL),E";
      return [addr+1, r];
    }
    break;
  case 0x74:
    {
      // LD   (HL),H
      var r = "LD (HL),H";
      return [addr+1, r];
    }
    break;
  case 0x75:
    {
      // LD   (HL),L
      var r = "LD (HL),L";
      return [addr+1, r];
    }
    break;
  case 0x76:
    {
      // HALT
      var r = "HALT";
      return [addr+1, r];
    }
    break;
  case 0x77:
    {
      // LD   (HL),A
      var r = "LD (HL),A";
      return [addr+1, r];
    }
    break;
  case 0x78:
    {
      // LD   A,B
      var r = "LD A,B";
      return [addr+1, r];
    }
    break;
  case 0x79:
    {
      // LD   A,C
      var r = "LD A,C";
      return [addr+1, r];
    }
    break;
  case 0x7A:
    {
      // LD   A,D
      var r = "LD A,D";
      return [addr+1, r];
    }
    break;
  case 0x7B:
    {
      // LD   A,E
      var r = "LD A,E";
      return [addr+1, r];
    }
    break;
  case 0x7C:
    {
      // LD   A,H
      var r = "LD A,H";
      return [addr+1, r];
    }
    break;
  case 0x7D:
    {
      // LD   A,L
      var r = "LD A,L";
      return [addr+1, r];
    }
    break;
  case 0x7E:
    {
      // LD   A,(HL)
      var r = "LD A,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x7F:
    {
      // LD   A,A
      var r = "LD A,A";
      return [addr+1, r];
    }
    break;
  case 0x80:
    {
      // ADD  A,B
      var r = "ADD A,B";
      return [addr+1, r];
    }
    break;
  case 0x81:
    {
      // ADD  A,C
      var r = "ADD A,C";
      return [addr+1, r];
    }
    break;
  case 0x82:
    {
      // ADD  A,D
      var r = "ADD A,D";
      return [addr+1, r];
    }
    break;
  case 0x83:
    {
      // ADD  A,E
      var r = "ADD A,E";
      return [addr+1, r];
    }
    break;
  case 0x84:
    {
      // ADD  A,H
      var r = "ADD A,H";
      return [addr+1, r];
    }
    break;
  case 0x85:
    {
      // ADD  A,L
      var r = "ADD A,L";
      return [addr+1, r];
    }
    break;
  case 0x86:
    {
      // ADD  A,(HL)
      var r = "ADD A,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x87:
    {
      // ADD  A,A
      var r = "ADD A,A";
      return [addr+1, r];
    }
    break;
  case 0x88:
    {
      // ADC  A,B
      var r = "ADC A,B";
      return [addr+1, r];
    }
    break;
    case 0x89:
      {
      // ADC  A,C
      var r = "ADC A,C";
      return [addr+1, r];
    }
    break;
  case 0x8A:
    {
      // ADC  A,D
      var r = "ADC A,D";
      return [addr+1, r];
    }
    break;
    case 0x8B:
      {
      // ADC  A,E
      var r = "ADC A,E";
      return [addr+1, r];
    }
    break;
  case 0x8C:
    {
      // ADC  A,H
      var r = "ADC A,H";
      return [addr+1, r];
    }
    break;
  case 0x8D:
    {
      // ADC  A,L
      var r = "ADC A,L";
      return [addr+1, r];
    }
    break;
  case 0x8E:
    {
      // ADC  A,(HL)
      var r = "ADC A,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x8F:
    {
      // ADC  A,A
      var r = "ADC A,A";
      return [addr+1, r];
    }
    break;
  case 0x90:
    {
      // SUB  B
      var r = "SUB B";
      return [addr+1, r];
    }
    break;
  case 0x91:
    {
      // SUB  C
      var r = "SUB C";
      return [addr+1, r];
    }
    break;
  case 0x92:
    {
      // SUB  D
      var r = "SUB D";
      return [addr+1, r];
    }
    break;
  case 0x93:
    {
      // SUB  E
      var r = "SUB E";
      return [addr+1, r];
    }
    break;
  case 0x94:
    {
      // SUB  H
      var r = "SUB H";
      return [addr+1, r];
    }
    break;
  case 0x95:
    {
      // SUB  L
      var r = "SUB L";
      return [addr+1, r];
    }
    break;
  case 0x96:
    {
      // SUB  (HL)
      var r = "SUB (HL)";
      return [addr+1, r];
    }
    break;
  case 0x97:
    {
      // SUB  A
      var r = "SUB A";
      return [addr+1, r];
    }
    break;
  case 0x98:
    {
      // SBC  A,B
      var r = "SBC A,B";
      return [addr+1, r];
    }
    break;
  case 0x99:
    {
      // SBC  A,C
      var r = "ABC A,C";
      return [addr+1, r];
    }
    break;
  case 0x9A:
    {
      // SBC  A,D
      var r = "SBC A,D";
      return [addr+1, r];
    }
    break;
  case 0x9B:
    {
      // SBC  A,E
      var r = "SBC A,E";
      return [addr+1, r];
    }
    break;
  case 0x9C:
    {
      // SBC  A,H
      var r = "SBC A,H";
      return [addr+1, r];
    }
    break;
  case 0x9D:
    {
      // SBC  A,L
      var r = "SBC A,L";
      return [addr+1, r];
    }
    break;
  case 0x9E:
    {
      //  SBC  A,(HL)
      var r = "SBC A,(HL)";
      return [addr+1, r];
    }
    break;
  case 0x9F:
    {
      // SBC  A,A
      var r = "SBC A,A";
      return [addr+1, r];
    }
    break;
  case 0xA0:
    {
      // AND  B
      var r = "AND B";
      return [addr+1, r];
    }
    break;
  case 0xA1:
    {
      // AND  C
      var r = "AND C";
      return [addr+1, r];
    }
    break;
  case 0xA2:
    {
      // AND  D
      var r = "AND D";
      return [addr+1, r];
    }
    break;
  case 0xA3:
    {
      // AND  E
      var r = "AND E";
      return [addr+1, r];
    }
    break;
  case 0xA4:
    {
      // AND  H
      var r = "AND H";
      return [addr+1, r];
    }
    break;
  case 0xA5:
    {
      // AND  L
      var r = "AND L";
      return [addr+1, r];
    }
    break;
  case 0xA6:
    {
      // AND  (HL)
      var r = "AND (HL)";
      return [addr+1, r];
    }
    break;
  case 0xA7:
    {
      // AND  A
      var r = "AND A";
      return [addr+1, r];
    }
    break;
  case 0xA8:
    {
      // XOR  B
      var r = "XOR B";
      return [addr+1, r];
    }
    break;
  case 0xA9:
    {
      // XOR  C
      var r = "XOR C";
      return [addr+1, r];
    }
    break;
  case 0xAA:
    {
      // XOR  D
      var r = "XOR D";
      return [addr+1, r];
    }
    break;
  case 0xAB:
    {
      // XOR  E
      var r = "XOR E";
      return [addr+1, r];
    }
    break;
  case 0xAC:
    {
      // XOR  H
      var r = "XOR H";
      return [addr+1, r];
    }
    break;
  case 0xAD:
    {
      // XOR  L
      var r = "XOR L";
      return [addr+1, r];
    }
    break;
  case 0xAE:
    {
      // XOR  (HL)
      var r = "XOR (HL)";
      return [addr+1, r];
    }
    break;
  case 0xAF:
    {
      // XOR  A
      var r = "XOR A";
      return [addr+1, r];
    }
    break;
  case 0xB0:
    {
      // OR  B
      var r = "OR B";
      return [addr+1, r];
    }
    break;
  case 0xB1:
    {
      // OR  C
      var r = "OR C";
      return [addr+1, r];
    }
    break;
  case 0xB2:
    {
      // OR  D
      var r = "OR D";
      return [addr+1, r];
    }
    break;
  case 0xB3:
    {
      // OR  E
      var r = "OR E";
      return [addr+1, r];
    }
    break;
  case 0xB4:
    {
      // OR  H
      var r = "OR H";
      return [addr+1, r];
    }
    break;
  case 0xB5:
    {
      // OR  L
      var r = "OR L";
      return [addr+1, r];
    }
    break;
  case 0xB6:
    {
      //  OR   (HL)
      var r = "OR (HL)";
      return [addr+1, r];
    }
    break;
  case 0xB7:
    {
      // OR  A
      var r = "OR A";
      return [addr+1, r];
    }
    break;
  case 0xB8:
    {
      //  CP   B
      var r = "CP B";
      return [addr+1, r];
    }
    break;
  case 0xB9:
    {
      //  CP   C
      var r = "CP C";
      return [addr+1, r];
    }
    break;
  case 0xBA:
    {
      //  CP   D
      var r = "CP D";
      return [addr+1, r];
    }
    break;
  case 0xBB:
    {
      //  CP   E
      var r = "CP E";
      return [addr+1, r];
    }
    break;
  case 0xBC:
    {
      //  CP   H
      var r = "CP H";
      return [addr+1, r];
    }
    break;
  case 0xBD:
    {
      //  CP   L
      var r = "CP L";
      return [addr+1, r];
    }
    break;
  case 0xBE:
    {
      // CP   (HL)
      var r = "CP (HL)";
      return [addr+1, r];
    }
    break;
  case 0xBF:
    {
      //  CP   A
      var r = "CP A";
      return [addr+1, r];
    }
    break;
  case 0xC0:
    {
      //  RET  NZ
      var r = "RET NZ";
      return [addr+1, r];
    }
    break;
  case 0xC1:
    {
      //  POP  BC
      var r = "POP BC";
      return [addr+1, r];
    }
    break;
  case 0xC2:
    {
      // JP   NZ,nn
      var r = "JP NZ," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xC3:
    {
      //  JP   nn
      var r = "JP " + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xC4:
    {
      //  CALL NZ,nn
      var r = "CALL NZ," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xC5:
    {
      //  PUSH BC
      var r = "PUSH BC";
      return [addr+1, r];
    }
    break;
  case 0xC6:
    {
      //  ADD  A,n
      var r = "ADD A," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xC7:
    {
      // RST  0
      var r = "RST 0";
      return [addr+1, r];
    }
    break;
  case 0xC8:
    {
      // RET Z
      var r = "RET Z";
      return [addr+1, r];
    }
    break;
  case 0xC9:
    {
      //// RET  nn
      //var r = "RET " + this.getWord(addr+1).toString(16);
      //return [addr+3, r];
      // RET
      var r = "RET";
      return [addr+1, r];
    }
    break;
  case 0xCA:
    {
      // JP   Z,nn
      var r = "JP Z," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xCC:
    {
      //  CALL Z,nn
      var r = "CALL Z," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xCD:
    {
      // CALL nn
      var r = "CALL " + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xCE:
    {
      // ADC  A,n
      var r = "ADC A," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xCF:
    {
      // RST  8
      var r = "RST 8";
      return [addr+1, r];
    }
    break;
  case 0xD0:
    {
      // RET NC
      var r = "RET NC";
      return [addr+1, r];
    }
    break;
  case 0xD1:
    {
      // POP DE
      var r = "POP DE";
      return [addr+1, r];
    }
    break;
  case 0xD2:
    {
      // JP   NC,nn
      var r = "JP NC," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xD3:
    {
      // OUT  (n),A
      var r = "OUT (" + this.ram[addr+1].toString(16) + "),A";
      return [addr+2, r];
    }
    break;
  case 0xD4:
    {
      //  CALL NC,nn
      var r = "CALL NC," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xD5:
    {
      //  PUSH DE
      var r = "PUSH DE";
      return [addr+1, r];
    }
    break;
  case 0xD6:
    {
      // SUB  n
      var r = "SUB " + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xD7:
    {
      // RST  10H
      var r = "RST 10H";
      return [addr+1, r];
    }
    break;
  case 0xD8:
    {
      // RET C
      var r = "RET C";
      return [addr+1, r];
    }
    break;
  case 0xDA:
    {
      // JP   C,nn
      var r = "JP C," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xDB:
    {
      // IN   A,(n)
      var r = "IN A,(" + this.ram[addr+1].toString(16) + ")";
      return [addr+2, r];
    }
    break;
  case 0xDC:
    {
      //  CALL C,nn
      var r = "CALL C," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xDE:
    {
      // SBC  A,n
      var r = "SBC A," + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xDF:
    {
      // RST  18H
      var r = "RST 18H";
      return [addr+1, r];
    }
    break;
  case 0xE0:
    {
      // RET PO
      var r = "RET PO";
      return [addr+1, r];
    }
    break;
  case 0xE1:
    {
      // POP HL
      var r = "POP HL";
      return [addr+1, r];
    }
    break;
  case 0xE2:
    {
      // JP   PO,nn
      var r = "JP PO," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xE3:
    {
      // EX   (SP),HL ;
      var r = "EX (SP),HL";
      return [addr+1, r];
    }
    break;
  case 0xE4:
    {
      //  CALL PO,nn
      var r = "CALL PO," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xE5:
    {
      //  PUSH HL
      var r = "PUSH HL";
      return [addr+1, r];
    }
    break;
  case 0xE6:
    {
      // AND  n
      var r = "AND " + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xE7:
    {
      // RST  20H
      var r = "RST 20H";
      return [addr+1, r];
    }
    break;
  case 0xE8:
    {
      // RET PE
      var r = "RET PE";
      return [addr+1, r];
    }
    break;
  case 0xE9:
    {
      // JP   (HL)
      var r = "JMP (HL)";
      return [addr+1, r];
    }
    break;
  case 0xEA:
    {
      // JP   PE,nn
      var r = "JP PE," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xEB:
    {
      // EX   DE,HL
      var r = "EX DE,HL";
      return [addr+1, r];
    }
    break;
  case 0xEC:
    {
      //  CALL PE,nn
      var r = "CALL PE,nn" + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xEE:
    {
      // XOR  n
      var r = "XOR " + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xEF:
    {
      // RST  28H
      var r = "RST 28H";
      return [addr+1, r];
    }
    break;
  case 0xF0:
    {
      // RET P
      var r = "RET P";
      return [addr+1, r];
    }
    break;
  case 0xF1:
    {
      // POP AF
      var r = "POP AF";
      return [addr+1, r];
    }
    break;
  case 0xF2:
    {
      // JP   P,nn
      var r = "JP P," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xF3:
    {
      // DI
      var r = "DI";
      return [addr+1, r];
    }
    break;
  case 0xF4:
      {
      //  CALL P,nn
      var r = "CALL P,nn" + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xF5:
    {
      //  PUSH AF
      var r = "PUSH AF";
      return [addr+1, r];
    }
    break;
  case 0xF6:
    {
      // OR   n
      var r = "OR " + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xF7:
    {
      // RST  30H
      var r = "RST 30H";
      return [addr+1, r];
    }
    break;
  case 0xF8:
    {
      // RET M
      var r = "RET M";
      return [addr+1, r];
    }
    break;
  case 0xF9:
    {
      // LD   SP,HL
      var r = "LD SP,HL";
      return [addr+1, r];
    }
    break;
  case 0xFA:
    {
      // JP   M,nn
      var r = "JP M," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xFB:
    {
      // EI
      var r = "EI";
      return [addr+1, r];
    }
    break;
  case 0xFC:
    {
      //  CALL M,nn
      var r = "CALL M," + this.getWord(addr+1).toString(16);
      return [addr+3, r];
    }
    break;
  case 0xFE:
    {
      // CP   n
      var r = "CP " + this.ram[addr+1].toString(16);
      return [addr+2, r];
    }
    break;
  case 0xFF:
    {
      // RST  38H
      var r = "RST 38H";
      return [addr+1, r];
    }
    break;
  default:
    {
      // illegal
      var r = "ILLEGAL";
      return [addr+1, r];
    }
    break;

  }
};

Cpu.prototype.disassemble1 = function(addr) {
  var r = [];
  var d = this.disassembleInstruction(addr);
  r.push(pad(addr.toString(16), 4));
  r.push(": ");
  for(var j = 0; j < d[0]-addr; j++)
    r.push(pad(this.ram[addr+j].toString(16), 2));
  while(j++ < 3)
    r.push("  ");
  r.push(" ");
  r.push(d[1]);
  return [d[0], r.join("")];
};

Cpu.prototype.disassemble = function(addr) {
  var r = [];
  for(var i=0; i < 16; ++i) {
    var l = this.disassemble1(addr);
    r.push(l[1]);
    r.push("\r\n");
    addr = l[0];
  }
  return [r.join(""), addr];
};


// vim: set shiftwidth=2 :
