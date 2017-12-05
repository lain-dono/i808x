'use strict'

console.log('start main')

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function SimpleMemio(conso, consi, conss, prn) {
    this.ram = new Uint8Array(0xFFFF)
}


SimpleMemio.prototype.rd = function(a) {
    return this.ram[a]
}

SimpleMemio.prototype.wr = function(a, b) {
    this.ram[a & 0xffff] = b & 0xff
    return b
}

let memio = new SimpleMemio()

memio.ram[0] = 0x3E
memio.ram[1] = 0xDE

memio.ram[2] = 0x04
memio.ram[3] = 0x0C
memio.ram[4] = 0x14
memio.ram[5] = 0x1C
memio.ram[6] = 0x24
memio.ram[7] = 0x2C

memio.ram[10] = 0xC3
memio.ram[11] = 0x00

let cpu = new Cpu(memio)

function pad(n, width, z) {
    z = z || '0';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function dec2hex(i, n) {
    return pad(i.toString(16).toUpperCase(), n)
}

document.body.onkeydown = function(e) {
    switch (e.keyCode) {
    case 32:
        app.step(1)
        e.preventDefault()
    break
    }
}

var app = new Vue({
    el: '#app',
    data: {
        sign: 0,
        zero: 0,
        aux: 0,
        parity: 0,
        carry: 0,

        pc: 0,
        cycles: 0,

        runned: false,
        interval: 0,
    },
    computed: {
        cpu() { return cpu },
    },
    methods: {
        at(addr) { return cpu.ram[addr] },
        asm(addr) { return cpu.disassembleInstruction(addr)[1] },
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

            this.pc = cpu.pc
            this.cycles = cpu.cycles
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
                //let i = randInt(200, 250)
                //while (i--) {
                    if (self.runned) {
                        self.runned = cpu.step()
                    }
                //}
                self.upd()
            }, 100)
        },
    }
})

var hexed
document.body.onload = function() {
    hexed = document.getElementById('hex')
    hexed.value = ''
    for (let i=0; i <= 0xFF; i++) {
        hexed.value += dec2hex(cpu.ram[i], 2) + ' '
    }
    hexed.style.height = (1.5+hexed.value.length/47)+'em';
    hexed.oninput = hex_editor
}

function hex_editor(self) {
    // On input, store the length of clean hex before the textarea caret in b
    let b = this.value
        .substr(0, this.selectionStart)
        .replace(/[^0-9A-F]/ig,"")
        .replace(/(..)/g,"$1 ")
        .length;

    // Clean the textarea value
    this.value = this.value
        .replace(/[^0-9A-F]/ig, '')
        .replace(/(..)/g, '$1 ')
        .replace(/ $/, '')
        .toUpperCase();

    // Set the height of the textarea according to its length
    this.style.height = (1.5+this.value.length/47)+'em';

    // Reset h
    this.h="";

    // Loop on textarea lines
    for (let i=0;i<this.value.length/48;i++) {
        // Add line number to h
        this.h += (1E7+(16*i).toString(16)).slice(-4)+" "
    }

    // Write h on the left column
    l.innerHTML = this.h;

    // Reset h
    this.h = '';
    // Loop on the hex values
    for(let i=0; i<this.value.length; i+=3) {
        // Convert them in numbers
        let c=parseInt(this.value.substr(i,2),16)

        // Convert in chars (if the charCode is in [64-126] (maybe more later)) or ".".
        this.h = 63 < c && 127>c ?
            this.h + String.fromCharCode(c):
            this.h + "."
    }

    // Write h in the right column (with line breaks every 16 chars)
    //r.innerHTML=h.replace(/(.{16})/g,"$1 ");
    // If the caret position is after a space or a line break, place it at the previous index so we can use backspace to erase hex code
    if (this.value[b]==" ")
        b--;

    if (this.value.length > 0xFF * 3 + 2) {
        this.value = this.value.substring(0, 0xFF * 3 + 2)
    }

    this.value.split(' ')
        .forEach((v, i) => cpu.ram[i] = parseInt(v, 16))

    app.$forceUpdate()

    // Put the textarea caret at the right place
    this.setSelectionRange(b, b)
}
