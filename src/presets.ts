import { combineRgb, CompanionPresetDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

export function UpdatePresets(self: ModuleInstance): void {
	const presets: CompanionPresetDefinitions = {}

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

	for (const io of Object.values(self.ios)) {
		const dir = io.direction()

		let bg_select_col = combineRgb(255, 255, 0)
		if (dir === 'IN') {
			bg_select_col = combineRgb(255, 255, 255)
		}

		let options = {
			io_key: io.key,
		}

		const dproto = io.displayProto()

		presets[`select_io_${io.key}`] = {
			category: `IO ${dproto}_${dir}`,
			name: `Select ${io.desc}: ${io.name}`,
			type: 'button',
			style: {
				text: `$(stageracer:io_name_${io.key})`,
				size: '18',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			feedbacks: [
				{
					feedbackId: `selected_${dir.toLowerCase()}`,
					style: {
						bgcolor: bg_select_col,
						color: combineRgb(0, 0, 0),
					},
					options: options,
				},
				{
					feedbackId: `take_tally_${dir.toLowerCase()}`,
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
							actionId: `select_${dir.toLowerCase()}`,
							options: options,
						},
					],
					up: [],
				},
			],
		}
	}

	self.setPresetDefinitions(presets)
}

// function buildIoPreset(
// 	presets: CompanionPresetDefinitions,
// 	vdef: CompanionVariableDefinition[],
// 	vval: CompanionVariableValues,
// 	node: Node,
// 	proto: Protocol,
// 	io: Io,
// 	indices: number[],
// ) {
// 	if (!io.en || (ioDir(io) !== 'IN' && ioDir(io) !== 'OUT')) {
// 		return
// 	}
//
// 	// We use the ember ID so that it will still work when we load the
// 	// config on different machines
// 	const path = `E${node.ember_id}_${proto}_${indices.join('_')}`
// 	const name = `${node.name}/${proto}/${indices.join('/')}`
//
// 	let bg_select_col = combineRgb(255, 255, 255)
//
// 	let options = {
// 		io_path: path,
// 	}
//
// 	let io_proto = io.proto
//
//         const proto_map: {[key: string]: string} = {
//             'ANALO_IN': 'ANALOG',
//             'ANALO_OUT': 'ANALOG',
//             'GPI': 'GPIO',
//             'GPO': 'GPIO',
//             'DANTE_CH': 'DANTE',
//             'SDI_PV': 'PREVIEW',
//             'SDI_ACH': 'SDI_AUDIO',
//             'GENLOCK': 'GL',
//             'MADI_CH': 'MADI_AUDIO',
//         };
//
//         io_proto = proto_map[io_proto] || io_proto;
//
// 	const io_name_var = `io_name_${path}`
//
// 	// We only care about DANTE_CH protocols, not the DANTE dummy node
// 	if (io.proto !== 'DANTE') {
// 	}
//
// 	vdef.push({
// 		name: `Name of port ${name}`,
// 		variableId: io_name_var,
// 	})
//
// 	vval[io_name_var] = io.name || `${proto} ${indices.join('/')}`
//
// 	// Recursively add children
// 	for (const [idx, cio] of io.children.entries()) {
// 		const cidx = indices.slice()
// 		cidx.push(idx + 1)
//
// 		buildIoPreset(presets, vdef, vval, node, proto, cio, cidx)
// 	}
// }
