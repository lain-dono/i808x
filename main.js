'use strict'

const VMEM = 0xA000

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function SimpleMemio(conso, consi, conss, prn) {
    this.ram = new Uint8Array(0xFFFF)
    this.key = 0
}

SimpleMemio.prototype.input = function(port) {
    switch (port) {
    case 0x00: return this.key
    }
    return 0
}

SimpleMemio.prototype.output = function(port, value) {
}


SimpleMemio.prototype.rd = function(a) {
    return this.ram[a]
}

SimpleMemio.prototype.wr = function(a, b) {
    this.ram[a & 0xffff] = b & 0xff
    return b
}

console.log('start main')


CodeMirror.defineSimpleMode('asm', {
    start: [

        {regex: /[^;]+:/, token: 'atom'},
        {regex: /;.*/, token: 'comment'},

        {regex: /([0-9abcdefABCDEF]+h)|([0-1]+b)|([0-9]+d?)/, token: 'number'},

    ],
    meta: {
        dontIndentState: ['comment'],
        lineComment: ';',
    },
})

let asm_code = document.getElementById('asm-code')
var myCodeMirror = CodeMirror.fromTextArea(asm_code, {
    mode: 'asm',
    lineNumbers: true,
    tabSize: 16,
    indentUnit: 16,
    smartIndent: true,
    readOnly: false,
    indentWithTabs: true,
})


let memio = new SimpleMemio()
let asm = new Assembler()
let cpu = new Cpu(memio)

reassemble()

function reassemble() {
    asm.assemble(myCodeMirror.getValue())
    asm.mem.length = 0xFFFF
    memio.ram = Uint8Array.from(asm.mem)
    cpu.ram = memio.ram
    cpu.reset()
}

function pad(n, width, z) {
    z = z || '0';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function dec2hex(i, n) {
    return pad(i.toString(16).toUpperCase(), n)
}

    /*
document.body.onkeydown = function(e) {
    switch (e.keyCode) {
    case 32:
        app.step(1)
        e.preventDefault()
    break
    }
}
*/

var app = new Vue({
    el: '#app',
    data: {
        sign: 0,
        zero: 0,
        aux: 0,
        parity: 0,
        carry: 0,
        interrupt: 0,

        pc: 0,
        cycles: 0,

        runned: false,
        interval: 0,

        xcode: 0,
    },
    filters: {
    },
    computed: {
        cpu() { return cpu },
        code: {
            get() {
                return this.xcode.toString(16)
            },
            set(v) {
                this.xcode = parseInt(v, 16) & 0xFF
            },
        }
    },
    mounted() {
        let canvas = document.getElementById('canvas')
        let video = new Screen(canvas, 160, 144)
        window.video = video
        this.update_screen()
        video.render()
    },
    methods: {
        update_screen() {
            let vid = window.video
            for (let y = 0; y < 144; y++) {
                let line = y * 0x40
                for (let x = 0; x < 160; x++) {
                    let addr = (line + x / 4) | 0
                    let byte = memio.ram[VMEM + addr]
                    let color
                    switch (x % 4) {
                        case 0: color = (byte >> 6) & 3; break;
                        case 1: color = (byte >> 4) & 3; break;
                        case 2: color = (byte >> 2) & 3; break;
                        case 3: color = (byte >> 0) & 3; break;
                    }
                    switch (color) {
                    case 0: color = 0xFFFFFF; break;
                    case 1: color = 0x999999; break;
                    case 2: color = 0xCC0000; break;
                    case 3: color = 0x000000; break;
                    }
                    vid.setPixel(x, y, color)
                }
            }
            window.video.render()
        },

        down(i) {
            console.log('down', i)
            memio.key |= 1 << i
        },

        up(i) {
            console.log('up', i)
            memio.key &= ~(1 << i)
        },


        commands() {
            let N = 0x10F
            let pc = cpu.pc
            return Array.apply(null, {length: N})
                .map(Number.call, Number)
                .map((v) => {
                    let addr = (v + pc - 0xF)
                    while (addr < 0) {
                        addr += 0xFFFF
                    }
                    return addr & 0xFFFF
                })
        },


        at(addr) { return cpu.ram[addr] },

        at_n(addr) {
            return 'nb' + need_by_code(cpu.ram[addr])
        },

        //asm(addr) { return cpu.disassembleInstruction(addr)[1] },
        asm(addr) {
            return asmval_by_code(memio.ram[addr], addr, (pc) => memio.ram[pc & 0xFFFF])
        },

        reassemble() {
            reassemble()
            this.upd()
            this.$forceUpdate()
        },


        asm_8(v) { return asmval_by_code(v) },

        hex8(i) { return dec2hex(i, 2) },
        hex16(i) { return dec2hex(i, 4) },

        step(n) {
            while (n--) {
                if (!cpu.step() && n--) break
            }
            this.upd()
            this.$forceUpdate()
        },
        upd() {
            this.sign = cpu.f & SIGN
            this.zero = cpu.f & ZERO
            this.aux = cpu.f & HALFCARRY
            this.parity = cpu.f & PARITY
            this.carry = cpu.f & CARRY
            this.interrupt = cpu.f & INTERRUPT

            this.pc = cpu.pc
            this.cycles = cpu.cycles

            this.update_screen()
        },

        stop_cpu() {
            this.runned = false
            clearInterval(this.interval)
            this.$nextTick(function () {
                this.upd()
            })
        },
        run_cpu() {
            var self = this
            this.runned = true
            this.interval = setInterval(function () {
                if (!self.runned) {
                    this.stop_cpu()
                    return
                }
                let i = randInt(20000, 25000)
                while (i--) {
                    if (self.runned) {
                        self.runned = cpu.step()
                    }
                }
                //self.upd()
                self.update_screen()
            }, 16)
        },
    }
})
