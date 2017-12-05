



const B = 0; // 000 B
const C = 1; // 001 C
const D = 2; // 010 D
const E = 3; // 011 E
const H = 4; // 100 H
const L = 5; // 101 L
const M = 6; // 110 M
const A = 7; // 111 A

const F = 6; // Flag Register

const RP_BC  = 0; // 00 B + C
const RP_DE  = 1; // 01 D + E
const RP_HL  = 2; // 10 H + L
const RP_PWS = 3; // 11 A + CPU Status Word

var MEM = new Uint8Array(0xFFFF);

var REG_MEM = new ArrayBuffer(12);
var REG = new DataView(REG_MEM);
var REG8 = new Uint8Array(REG_MEM);

var ENDIAN = true;

function HL() {
    let hl_addr = REG.getUint16(H, ENDIAN)
}


