'use strict'

function need_by_code(cmd) {
	switch (cmd) {
	case 0x01:
	case 0x11:
	case 0x21:
	case 0x31: return 3
	case 0x22:
	case 0x32: return 3
	case 0x2a:
	case 0x3a: return 3
	case 0x06:
	case 0x16:
	case 0x26:
	case 0x36: return 2
	case 0x0e:
	case 0x1e:
	case 0x2e:
	case 0x3e: return 2

	case 0xc2:
	case 0xd2:
	case 0xe2:
	case 0xf2:
	case 0xca:
	case 0xda:
	case 0xea:
	case 0xfa:

	case 0xc4:
	case 0xd4:
	case 0xe4:
	case 0xf4:
	case 0xcc:
	case 0xdc:
	case 0xec:
	case 0xfc: return 3

	case 0xc3: return 3
	case 0xcd: return 3

	case 0xd3: return 2
	case 0xdb: return 2


	case 0xc6:
	case 0xd6:
	case 0xe6:
	case 0xf6: return 2

	case 0xce:
	case 0xde:
	case 0xee:
	case 0xfe: return 2

	}
	return 1
}

function asmval_by_code(cmd, first, second) {
	let kind = cmd >> 6
	let dst = (cmd >> 3) & 7
	let rp_sp = (cmd >> 4) & 3
	let src = (cmd >> 0) & 7

	switch (cmd) {
	case 0x00: return 'NOP'

	case 0x10:
	case 0x20:
	case 0x30:

	case 0x08:
	case 0x18:
	case 0x28:
	case 0x38:

	case 0xcb:
	case 0xd9:
	case 0xdd:
	case 0xed:
	case 0xfd:
		return undefined

	case 0x76:
		return 'HLT'

	case 0x02:
	case 0x12:
		return `STAX ${rp_sp_text(rp_sp)}`
	case 0x22: return `SHLD a16`
	case 0x32: return `STA a16`

	case 0x0A:
	case 0x1A:
		return `LDAX ${rp_sp_text(rp_sp)}`
	case 0x2A: return `LHLD a16`
	case 0x3A: return `LDA a16`

	case 0x07: return `RCL`
	case 0x17: return `RAL`
	case 0x27: return `DDA`
	case 0x37: return `STC`

	case 0x0F: return `RCR`
	case 0x1F: return `RAR`
	case 0x2F: return `CMA`
	case 0x3F: return `CMC`

	case 0xc1:
	case 0xd1:
	case 0xe1:
	case 0xf1:
		return `POP ${rp_psw_text(rp_sp)}`

	case 0xc5:
	case 0xd5:
	case 0xe5:
	case 0xf5:
		return `PUSH ${rp_psw_text(rp_sp)}`

	case 0xc0: return 'RNZ a16'
	case 0xd0: return 'RNC a16'
	case 0xe0: return 'RPO a16'
	case 0xf0: return 'RP a16'
	case 0xc8: return 'RZ a16'
	case 0xd8: return 'RC a16'
	case 0xe8: return 'RPE a16'
	case 0xf8: return 'RM a16'

	case 0xc2: return 'JNZ a16'
	case 0xd2: return 'JNC a16'
	case 0xe2: return 'JPO a16'
	case 0xf2: return 'JP a16'
	case 0xca: return 'JZ a16'
	case 0xda: return 'JC a16'
	case 0xea: return 'JPE a16'
	case 0xfa: return 'JM a16'

	case 0xc4: return 'CNZ a16'
	case 0xd4: return 'CNC a16'
	case 0xe4: return 'CPO a16'
	case 0xf4: return 'CP a16'
	case 0xcc: return 'CZ a16'
	case 0xdc: return 'CC a16'
	case 0xec: return 'CPE a16'
	case 0xfc: return 'CM a16'


	case 0xc3: return 'JMP a16'
	case 0xd3: return 'OUT port'
	case 0xe3: return 'XTHL'
	case 0xf3: return 'DI'

	case 0xc9: return 'RET'
	case 0xe9: return 'PCHL'
	case 0xf9: return 'SPHL'

	case 0xdb: return 'IN port'
	case 0xeb: return 'XCHG'
	case 0xfb: return 'EI'

	case 0xcd: return 'CALL a16'

	}

	switch (kind) {
	case 0:
		switch (src) {
		case 1: { // LXI/DAD
			if (dst & 1) {
				return `DAD ${rp_sp_text(rp_sp)}`
			} else {
				return `LXI ${rp_sp_text(rp_sp)}, d16`
			}
		}

		case 3: { // DCX/INX
			if (dst & 1) {
				return `DCX ${rp_sp_text(rp_sp)}`
			} else {
				return `INX ${rp_sp_text(rp_sp)}`
			}
		}

		case 4:
			return `INR ${regm_text(dst)}`
		case 5:
			return `DCR ${regm_text(dst)}`
		case 6:
			return `MVI ${regm_text(dst)}, d8`
		}
		break
	case 1:
		return `MOV ${regm_text(dst)}, ${regm_text(src)}`
	case 2:
		return `${alu_text(dst)} ${regm_text(src)}`
	case 3:
		switch (src) {
		case 0x7:
		case 0xF:
			return `RST ${dst}`

		case 0x6:
		case 0xe:
			return `${imm_text(dst)} d8`
		}
	}
}

function imm_text(imm) {
	switch (imm) {
	case 0: return 'ADI'
	case 1: return 'ACI'
	case 2: return 'SUI'
	case 3: return 'SBI'
	case 4: return 'ANI'
	case 5: return 'XRI'
	case 6: return 'ORI'
	case 7: return 'CPI'
	default: throw 'wtf?'
	}
}


function regm_text(reg) {
	switch (reg) {
	case 0: return 'B'
	case 1: return 'C'
	case 2: return 'D'
	case 3: return 'E'
	case 4: return 'H'
	case 5: return 'L'
	case 6: return 'M'
	case 7: return 'A'
	default: throw 'wtf?'
	}
}

function alu_text(alu) {
	switch (alu) {
	case 0: return 'ADD'
	case 1: return 'ADC'
	case 2: return 'SUB'
	case 3: return 'SBB'
	case 4: return 'ANA'
	case 5: return 'XNA'
	case 6: return 'ORA'
	case 7: return 'CMP'
	default: throw 'wtf?'
	}
}

function rp_sp_text(rp) {
	switch (rp) {
	case 0: return 'B'
	case 1: return 'D'
	case 2: return 'H'
	case 3: return 'SP'
	default: throw 'wtf?'
	}
}

function rp_psw_text(rp) {
	switch (rp) {
	case 0: return 'B'
	case 1: return 'D'
	case 2: return 'H'
	case 3: return 'PSW'
	default: throw 'wtf?'
	}
}



