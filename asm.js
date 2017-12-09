'use strict'

const IS_WORD = /^\w+$/
const BY_LINE = /\r?\n/
const NON_SPACE = /\S+/g

function asm_regm(regm) {
	switch (regm) {
	case 'B': return 0
	case 'C': return 1
	case 'D': return 2
	case 'E': return 3
	case 'H': return 4
	case 'L': return 5
	case 'M': return 6
	case 'A': return 7
	default:
			throw 'wtf?'
	}
}

function Assembler(source) {
	this.src = source.split(BY_LINE)
	this.current = 0
	this.labels = {}
	this.dst = new Uint8Array(0xFFFF)
	this.location_counter = 0
}

Assembler.prototype.simple = function(byte) {
	this.dst[this.location_counter] = byte
	this.location_counter += 1
	return byte
}

Assembler.prototype.parse_line = function() {
	let line = this.src[this.current].toUpperCase()
	this.current += 1

	let maybe_label = line.split(':', 2)
	console.log(maybe_label)
	if (maybe_label.length === 2) {
		// found
		let label = maybe_label[0].trim()
		if (IS_WORD.test(label)) {
			this.labels[label] = this.location_counter
		} else {
			console.error('fail parse label', line)
			return
		}
		line = maybe_label[1]
	} else {
		console.log('without label')
		// not found
		line = maybe_label[0]
	}

	let words = line.match(NON_SPACE) || []

	console.log(words)

	let command = words.shift()
	console.log(command)
	switch (command) {
	case 'NOP':  return this.simple(0x00)
	case 'HLT':  return this.simple(0x76)

	// last
	case 'RNZ':  return this.simple(0xc0)
	case 'RNC':  return this.simple(0xd0)
	case 'RPO':  return this.simple(0xe0)
	case 'RP':   return this.simple(0xf0)

	case 'RZ':   return this.simple(0xc8)
	case 'RC':   return this.simple(0xd8)
	case 'RPE':  return this.simple(0xe8)
	case 'RM':   return this.simple(0xf8)

	case 'RET':  return this.simple(0xc9)
	case 'PCHL': return this.simple(0xe9)
	case 'SPHL': return this.simple(0xf9)

	case 'XTHL': return this.simple(0xe3)
	case 'DI':   return this.simple(0xf3)
	case 'XCHG': return this.simple(0xeb)
	case 'EI':   return this.simple(0xfb)

	case 'ADD': return this.simple(0x80 + asm_regm(words[0]))
	case 'ADC': return this.simple(0x8b + asm_regm(words[0]))
	case 'SUB': return this.simple(0x90 + asm_regm(words[0]))
	case 'SBB': return this.simple(0x9b + asm_regm(words[0]))
	case 'ANA': return this.simple(0xa0 + asm_regm(words[0]))
	case 'XNA': return this.simple(0xab + asm_regm(words[0]))
	case 'ORA': return this.simple(0xb0 + asm_regm(words[0]))
	case 'CMP': return this.simple(0xbb + asm_regm(words[0]))

	/*
	case 'MOV':
		break
	case 'ADD':
		break
	*/
	default:
		console.error('fail parse line', line)
	}
}
