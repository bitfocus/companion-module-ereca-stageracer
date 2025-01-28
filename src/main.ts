import { InstanceBase, runEntrypoint, SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'
import { UpdatePresets } from './presets.js'
import { RacerProto, Node } from './protocol.js'

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig // Setup in init()
	proto: RacerProto | null = null

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.configUpdated(config)
	}

	// When module gets deleted
	async destroy(): Promise<void> {
		if (this.proto) {
			this.proto.destroy()
			this.proto = null
		}
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config

		if (this.config.pollInterval < 250) {
			this.config.pollInterval = 250
		}

		if (this.proto) {
			this.proto.destroy()
			this.proto = null
		}

		this.proto = new RacerProto(this)
		this.proto.init()
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

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	updatePresets(): void {
		UpdatePresets(this)
	}

	updatePorts(): void {
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.updatePresets()
	}

	get nodes(): Node[] {
		if (!this.proto) {
			throw new Error('No protocol!')
		}

		let nodes = Object.values(this.proto.nodes)

		// Make sure the nodes are always in the same order for consistency
		nodes.sort((a, b) => a.name.localeCompare(b.name))

		return nodes
	}

	get proto_filter(): Set<string> {
		return new Set((this.config.protoFilter || '').split(',').map((g) => g.toUpperCase().trim()))
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
