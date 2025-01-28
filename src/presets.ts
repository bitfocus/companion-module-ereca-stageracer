import { combineRgb, CompanionPresetDefinitions } from '@companion-module/base'
import type { CompanionVariableDefinition, CompanionVariableValues } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import type { Node, Protocol, Io } from './protocol.js'
import { ioDir } from './protocol.js'

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}
	const vdef: CompanionVariableDefinition[] = []
	const vval: CompanionVariableValues = {}

	presets['take'] = {
		category: 'Actions',
		name: 'Take',
		type: 'button',
		style: {
			text: 'Take',
			size: '18',
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(0, 0, 0),
		},
		feedbacks: [
			{
				feedbackId: 'take',
				style: {
					bgcolor: combineRgb(255, 0, 0),
					color: combineRgb(255, 255, 255),
				},
				options: {},
			},
		],
		steps: [
			{
				down: [
					{
						actionId: 'take',
						options: {},
					},
				],
				up: [],
			},
		],
	}

	presets['clear'] = {
		category: 'Actions',
		name: 'Clear',
		type: 'button',
		style: {
			text: 'Clear',
			size: '18',
			color: combineRgb(128, 128, 128),
			bgcolor: combineRgb(0, 0, 0),
		},
		feedbacks: [
			{
				feedbackId: 'clear',
				style: {
					bgcolor: combineRgb(0, 0, 0),
					color: combineRgb(255, 255, 255),
				},
				options: {},
			},
		],
		steps: [
			{
				down: [
					{
						actionId: 'clear',
						options: {},
					},
				],
				up: [],
			},
		],
	}

	const proto_filter = self.proto_filter

	for (const node of Object.values(self.nodes)) {
		const protos = Object.keys(node.ios_by_proto)
			.filter((proto) => !proto_filter.has(proto))
			.sort()

		for (const proto of protos) {
			const ios = node.ios_by_proto[proto]

			for (const [idx, io] of ios.entries()) {
				buildIoPreset(presets, vdef, vval, node, proto, io, [idx + 1])
			}
		}
	}

	self.setVariableDefinitions(vdef)
	self.setVariableValues(vval)
	self.setPresetDefinitions(presets)
}

function buildIoPreset(
	presets: CompanionPresetDefinitions,
	vdef: CompanionVariableDefinition[],
	vval: CompanionVariableValues,
	node: Node,
	proto: Protocol,
	io: Io,
	indices: number[],
) {
	if (!io.en || (ioDir(io) !== 'IN' && ioDir(io) !== 'OUT')) {
		return
	}

	// We use the ember ID so that it will still work when we load the
	// config on different machines
	const path = `E${node.ember_id}_${proto}_${indices.join('_')}`
	const name = `${node.name}/${proto}/${indices.join('/')}`

	let bg_select_col = combineRgb(255, 255, 255)

	let options = {
		io_path: path,
	}

	let io_proto = io.proto

	if (io_proto == 'ANALO_IN' || io_proto == 'ANALO_OUT') {
		io_proto = 'ANALO'
	}
	if (io_proto == 'GPI' || io_proto == 'GPO') {
		io_proto = 'GPIO'
	}

	if (io_proto == 'DANTE_CH') {
		io_proto = 'DANTE'
	}

	const io_name_var = `io_name_${path}`

	// We only care about DANTE_CH protocols, not the DANTE dummy node
	if (io.proto !== 'DANTE') {
		presets[`select_io_${path}`] = {
			category: `${io_proto} ${ioDir(io)}`,
			name: `Select ${name}: ${io.name}`,
			type: 'button',
			style: {
				text: `$(stageracer:${io_name_var})`,
				size: '18',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			feedbacks: [
				{
					feedbackId: `selected_${ioDir(io).toLowerCase()}`,
					style: {
						bgcolor: bg_select_col,
						color: combineRgb(0, 0, 0),
					},
					options: options,
				},
				{
					feedbackId: `take_tally_${ioDir(io).toLowerCase()}`,
					style: {
						bgcolor: combineRgb(255, 0, 0),
						color: combineRgb(255, 255, 255),
					},
					options: options,
				},
			],
			steps: [
				{
					down: [
						{
							actionId: `select_${ioDir(io).toLowerCase()}`,
							options: options,
						},
					],
					up: [],
				},
			],
		}
	}

	vdef.push({
		name: `Name of port ${name}`,
		variableId: io_name_var,
	})

	vval[io_name_var] = io.name || `${proto}/${indices.join('/')}`

	// Recursively add children
	for (const [idx, cio] of io.children.entries()) {
		const cidx = indices.slice()
		cidx.push(idx + 1)

		buildIoPreset(presets, vdef, vval, node, proto, cio, cidx)
	}
}
