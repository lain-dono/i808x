


Cpu.prototype.by_code = function(code) {



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



