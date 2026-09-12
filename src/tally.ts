import type { ModuleInstance } from './main.js'
import type { IoData, IoKey } from './protocol.js'
import { TallyColour, TslSender } from './tsl.js'

export type TallyLamp = 'red' | 'green' | 'amber'

type PipTallyState = {
	text: string
	red: boolean
	green: boolean
	amber: boolean
}

/**
 * Source-based tally that follows routing onto destinations and MV PIPs.
 * MV updates are sent as TSL UMD v5 to the StageRacer host:9801.
 */
export class TallyManager {
	private readonly sender = new TslSender()
	private redSources = new Set<IoKey>()
	private greenSources = new Set<IoKey>()
	private amberSources = new Set<IoKey>()
	/** Last TSL state sent per screen:display, so we can clear and debounce */
	private lastPip = new Map<string, PipTallyState>()

	constructor(private readonly module: ModuleInstance) {}

	public destroy(): void {
		this.sender.destroy()
		this.redSources.clear()
		this.greenSources.clear()
		this.amberSources.clear()
		this.lastPip.clear()
	}

	public setHost(host: string): void {
		this.sender.setHost(host)
	}

	public setSourceTally(sourceKey: IoKey, lamp: TallyLamp, on: boolean): void {
		if (on) {
			// Only one colour active per source
			this.redSources.delete(sourceKey)
			this.greenSources.delete(sourceKey)
			this.amberSources.delete(sourceKey)

			const set = lamp === 'red' ? this.redSources : lamp === 'green' ? this.greenSources : this.amberSources
			set.add(sourceKey)
		} else {
			const set = lamp === 'red' ? this.redSources : lamp === 'green' ? this.greenSources : this.amberSources
			set.delete(sourceKey)
		}

		this.sync()
	}

	public isSourceTallied(sourceKey: IoKey, lamp: TallyLamp = 'red'): boolean {
		const set = lamp === 'red' ? this.redSources : lamp === 'green' ? this.greenSources : this.amberSources
		return set.has(sourceKey)
	}

	/** Stop sending TSL without clearing StageRacer (avoids overwriting names). */
	public disableOutput(): void {
		this.lastPip.clear()
	}

	/**
	 * Recompute inherited tally from current crosspoints and push TSL to MV PIPs.
	 * Call after port/routing refresh and after setSourceTally.
	 */
	public sync(): void {
		if (!this.module.config.enableTally) {
			return
		}

		const ios = this.module.ios

		const redDestinations = new Set<IoKey>()
		const greenDestinations = new Set<IoKey>()
		const amberDestinations = new Set<IoKey>()
		for (const io of Object.values(ios)) {
			if (!io.isOutput() || !io.src_key) {
				continue
			}
			if (this.redSources.has(io.src_key)) {
				redDestinations.add(io.key)
			}
			if (this.greenSources.has(io.src_key)) {
				greenDestinations.add(io.key)
			}
			if (this.amberSources.has(io.src_key)) {
				amberDestinations.add(io.key)
			}
		}

		const desired = new Map<string, PipTallyState>()

		for (const pip of Object.values(ios)) {
			if (pip.protocol !== 'SDI_PV') {
				continue
			}

			const addr = this.pipAddress(pip)
			if (!addr) {
				continue
			}

			const shown = pip.src_key ? ios[pip.src_key] : undefined
			if (!shown) {
				desired.set(addr.key, { text: '', red: false, green: false, amber: false })
				continue
			}

			const red = this.redSources.has(shown.key) || redDestinations.has(shown.key)
			const green = this.greenSources.has(shown.key) || greenDestinations.has(shown.key)
			const amber = this.amberSources.has(shown.key) || amberDestinations.has(shown.key)

			desired.set(addr.key, { text: shown.name, red, green, amber })
		}

		for (const [key, prev] of this.lastPip) {
			if (!desired.has(key) && (prev.red || prev.green || prev.amber)) {
				const [screenStr, displayStr] = key.split(':')
				this.sender.send({
					screen: Number(screenStr),
					display: Number(displayStr),
					text: prev.text,
					rhTally: TallyColour.Off,
					lhTally: TallyColour.Off,
					textTally: TallyColour.Off,
				})
			}
		}

		for (const [key, state] of desired) {
			const prev = this.lastPip.get(key)
			if (
				prev &&
				prev.text === state.text &&
				prev.red === state.red &&
				prev.green === state.green &&
				prev.amber === state.amber
			) {
				continue
			}

			const [screenStr, displayStr] = key.split(':')
			const { rh, lh, text } = this.coloursFor(state)

			this.sender.send({
				screen: Number(screenStr),
				display: Number(displayStr),
				text: state.text,
				rhTally: rh,
				lhTally: lh,
				textTally: text,
			})
		}

		this.lastPip = desired
	}

	/** Explicit amber wins; otherwise RH=red, LH=green. */
	private coloursFor(state: PipTallyState): { rh: number; lh: number; text: number } {
		if (state.amber) {
			return { rh: TallyColour.Amber, lh: TallyColour.Amber, text: TallyColour.Amber }
		}

		return {
			rh: state.red ? TallyColour.Red : TallyColour.Off,
			lh: state.green ? TallyColour.Green : TallyColour.Off,
			text: state.red ? TallyColour.Red : state.green ? TallyColour.Green : TallyColour.Off,
		}
	}

	private pipAddress(pip: IoData): { key: string; screen: number; display: number } | undefined {
		if (pip.frame_index === undefined || !pip.parent_key) {
			return undefined
		}

		const parent = this.module.ios[pip.parent_key]
		if (!parent) {
			return undefined
		}

		const screen = parent.tslScreen()
		if (screen === undefined) {
			return undefined
		}

		// StageRacer uses 1-based display indices matching FRAME-N (not TSL's usual 0-based)
		const display = pip.frame_index
		if (display < 1) {
			return undefined
		}

		return { key: `${screen}:${display}`, screen, display }
	}
}
