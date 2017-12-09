'use strict'

function setPixel(m, x, y, color) {
	let i = (y * (m.width | 0) + x) * 4
	m.data[i++] = (color >> 16) & 0xFF
	m.data[i++] = (color >> 8) & 0xFF
	m.data[i++] = color & 0xFF
	m.data[i] = (color >> 24) & 0xFF
}

function Screen(canvas, width, height) {
	canvas.width = width
	canvas.height = height

	let ctx = canvas.getContext('2d')
	this.width = width
	this.height = height
	this.ctx = ctx
	this.canvas = canvas
	this.image = ctx.createImageData(width, height)
}

Screen.prototype.render = function() {
	/*
	this.canvas.fillRect(0, 0, this.width, this.height)
	this.copyScreen()
	*/

	this.canvas.width = this.width
	this.canvas.height = this.height

	this.ctx.fill = 'green'
	this.ctx.fillRect(0, 0, this.width, this.height)
	this.ctx.putImageData(this.image, 0, 0);
}

Screen.prototype.copyScreen = function () {
	var color = 0;
	var k = 0;
	var src;
	var vram;
	for(var j = 0; j < this.height; j++) {
		src = 0x2400 + (j << 5);
		k = 0;
		for(var i = 0; i < 32; i++) {
			vram = this.cpu.memory[src];
			src += 1;
			for(var b = 0; b < 8; b++) {
				color = 0xFF000000;
				if(vram & 1) {
					color = 0xFFFFFFFF;
				}
				this.setPixel(this.image, k, j, color);
				k++;
				vram = vram >> 1;
			}
		}
	}
	this.canvas.putImageData(this.image, 0, 0);
}

Screen.prototype.setPixel = function(x, y, color) {
	color |= 0xFF000000;
	setPixel(this.image, x, y, color)
}
