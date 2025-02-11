import { InstanceBase, runEntrypoint, SomeCompanionConfigField, DropdownChoice } from '@companion-module/base'
import { InstanceStatus } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { UpdateVariableDefinitions } from './variables.js'
import { RacerProto, Node, IoKey, IoData } from './protocol.js'

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig // Setup in init()
	proto: RacerProto | undefined = undefined
	curStatus: [InstanceStatus, string | undefined] | undefined = undefined
	selectedDestination: IoKey | undefined = undefined
	// When using "take", this contains the pending routing instructions
	pendingRoute: { src: IoKey | null; dst: IoKey; compatible: boolean } | undefined = undefined

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		await this.configUpdated(config)
	}

	// When module gets deleted
	async destroy(): Promise<void> {
		if (this.proto) {
			this.proto.destroy()
			this.proto = undefined
		}
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config

		if (this.config.pollInterval < 250) {
			this.config.pollInterval = 250
		}

		this.config.apiToken = this.config.apiToken.trim()

		if (!this.config.apiToken) {
			this.config.apiToken = 'SRK_ERECA'
		}

		if (this.config.host?.trim() === 'sim.ereca.fr') {
			this.config.useHttps = true
		}

		if (this.proto) {
			this.proto.destroy()
			this.proto = undefined
		}

		this.proto = new RacerProto(this)
		await this.proto.init()

		if (!this.config.take) {
			this.pendingRoute = undefined
		}
	}

	async setStatus(status: InstanceStatus, desc: string | undefined = undefined): Promise<void> {
		if (this.curStatus && this.curStatus[0] == status && this.curStatus[1] == desc) {
			return
		}

		this.curStatus = [status, desc]

		this.updateStatus(status, desc)
	}

	// Return config fields for web config
	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	updatePorts(): void {
		this.updateActions()
		this.updateFeedbacks()
		this.updatePresets()
		this.updateVariableDefinitions()
		this.checkFeedbacks()
	}

	get protocol(): RacerProto {
		if (!this.proto) {
			throw new Error('No protocol!')
		}

		return this.proto
	}

	get nodes(): Node[] {
		const nodes = Object.values(this.protocol.nodes)

		// Make sure the nodes are always in the same order for consistency
		nodes.sort((a, b) => a.name.localeCompare(b.name))

		return nodes
	}

	get ios(): { [key: IoKey]: IoData } {
		return this.protocol.ios
	}

	nodeByEmberId(ember_id: number): Node | undefined {
		return this.nodes.find((n) => n.ember_id == ember_id)
	}

	get protoFilter(): string[] {
		return (this.config.protoFilter || '')
			.split(',')
			.map((g) => g.toUpperCase().trim())
			.filter((f) => f !== '')
	}

	outputChoices(): DropdownChoice[] {
		const ios = Object.values(this.ios)
			.filter((io) => io.isOutput())
			.sort((a, b) => a.key.localeCompare(b.key))

		return ios.map((io) => ({
			id: io.key,
			label: io.name,
		}))
	}

	inputChoices(): DropdownChoice[] {
		const ios = Object.values(this.ios)
			.filter((io) => io.isInput())
			.sort((a, b) => a.key.localeCompare(b.key))

		return ios.map((io) => ({
			id: io.key,
			label: io.name,
		}))
	}

	nodeChoices(): DropdownChoice[] {
		return this.nodes.map((n) => ({
			id: n.ember_id,
			label: n.name,
		}))
	}

	setSelectedDestination(key: IoKey): void {
		this.selectedDestination = key

		this.checkFeedbacks('selected_in', 'selected_out', 'take_tally_in')
	}

	selectedDestinationIo(): IoData | undefined {
		if (!this.selectedDestination) {
			return undefined
		}

		return this.ios[this.selectedDestination]
	}

	async queueRoute(src: IoData, dst: IoData): Promise<void> {
		const compatible = src.canStreamTo(dst)

		if (this.config.take) {
			this.pendingRoute = {
				src: src.key,
				dst: dst.key,
				compatible: compatible,
			}
		} else if (compatible) {
			this.pendingRoute = undefined
			await this.protocol.route(src, dst)
		}

		this.checkFeedbacks('take', 'take_incompatible', 'selected_in', 'selected_out', 'take_tally_in', 'take_tally_out')
	}

	async queueDisconnect(dst: IoData): Promise<void> {
		if (this.config.take) {
			this.pendingRoute = {
				src: null,
				dst: dst.key,
				compatible: true,
			}
		} else {
			this.pendingRoute = undefined
			await this.protocol.disconnect(dst)
		}

		this.checkFeedbacks('take', 'take_incompatible', 'selected_in', 'selected_out', 'take_tally_in', 'take_tally_out')
	}

	async applyPendingRoute(): Promise<void> {
		if (!this.pendingRoute || !this.pendingRoute.compatible) {
			return
		}

		const route = this.pendingRoute
		await this.clearPendingRoute()

		const dst = this.ios[route.dst]
		if (!dst) {
			this.log('error', `Can't find IO ${route.dst}`)
			return
		}

		if (route.src) {
			const src = this.ios[route.src]

			if (!src) {
				this.log('error', `Can't find IO ${route.src}`)
				return
			}

			return this.protocol.route(src, dst)
		} else {
			await this.protocol.disconnect(dst)
		}
	}

	async clearPendingRoute(): Promise<void> {
		if (!this.pendingRoute) {
			return
		}

		this.pendingRoute = undefined
		this.checkFeedbacks('take', 'take_incompatible', 'selected_in', 'selected_out', 'take_tally_in', 'take_tally_out')
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
