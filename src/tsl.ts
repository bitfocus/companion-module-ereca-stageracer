import dgram from 'dgram'

export const TSL_PORT = 9801

/** TSL UMD v5 tally colours */
export const TallyColour = {
	Off: 0,
	Red: 1,
	Green: 2,
	Amber: 3,
} as const

export type TslDisplayUpdate = {
	screen: number
	/** 0-based display / PIP index */
	display: number
	text: string
	rhTally?: number
	lhTally?: number
	textTally?: number
	brightness?: number
}

/**
 * Compose a TSL UMD v5 UDP packet (ASCII labels, display messages).
 * Spec: little-endian, PBC / VER / FLAGS / SCREEN / DMSG…
 */
export function composeTslV5(update: TslDisplayUpdate): Buffer {
	const textBuf = Buffer.from(update.text ?? '', 'ascii')
	const brightness = (update.brightness ?? 3) & 0x3
	const rh = (update.rhTally ?? TallyColour.Off) & 0x3
	const txt = (update.textTally ?? rh) & 0x3
	const lh = (update.lhTally ?? TallyColour.Off) & 0x3

	// CONTROL: bits 0-1 RH, 2-3 text, 4-5 LH, 6-7 brightness
	const control = rh | (txt << 2) | (lh << 4) | (brightness << 6)

	// DMSG body after SCREEN: INDEX(2) + CONTROL(2) + LENGTH(2) + TEXT
	const dmsgLen = 2 + 2 + 2 + textBuf.length
	// Packet after PBC: VER(1) + FLAGS(1) + SCREEN(2) + DMSG
	const afterPbc = 1 + 1 + 2 + dmsgLen

	const buf = Buffer.alloc(2 + afterPbc)
	let o = 0
	buf.writeUInt16LE(afterPbc, o)
	o += 2
	buf.writeUInt8(0, o++) // VER
	buf.writeUInt8(0, o++) // FLAGS: ASCII, display data
	buf.writeUInt16LE(update.screen & 0xffff, o)
	o += 2
	buf.writeUInt16LE(update.display & 0xffff, o)
	o += 2
	buf.writeUInt16LE(control & 0xffff, o)
	o += 2
	buf.writeUInt16LE(textBuf.length & 0xffff, o)
	o += 2
	textBuf.copy(buf, o)

	return buf
}

export class TslSender {
	private socket: dgram.Socket | undefined
	private host: string = ''

	public setHost(host: string): void {
		this.host = host.trim()
	}

	public destroy(): void {
		if (this.socket) {
			this.socket.close()
			this.socket = undefined
		}
	}

	public send(update: TslDisplayUpdate): void {
		if (!this.host) {
			return
		}

		const packet = composeTslV5(update)

		if (!this.socket) {
			this.socket = dgram.createSocket('udp4')
			this.socket.on('error', () => {
				// Recreate on next send
				try {
					this.socket?.close()
				} catch {
					/* ignore */
				}
				this.socket = undefined
			})
		}

		this.socket.send(packet, TSL_PORT, this.host)
	}
}
