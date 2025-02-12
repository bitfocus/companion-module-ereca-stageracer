import { combineRgb, CompanionPresetDefinitions, CompanionPresetFeedback } from '@companion-module/base'
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
			{
				feedbackId: 'take_incompatible',
				style: {
					bgcolor: combineRgb(255, 200, 255),
					color: combineRgb(255, 0, 0),
					text: 'Take invalid',
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
				feedbackId: 'take',
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

	presets['target_id'] = {
		category: 'Miscellaneous',
		name: 'Target identifier',
		type: 'button',
		style: {
			text: '$(stageracer:target_id)',
			size: '18',
			color: combineRgb(255, 255, 128),
			bgcolor: combineRgb(0, 50, 0),
		},
		feedbacks: [],
		steps: [],
	}

	presets[`select_io_disconnected`] = {
		category: `Pseudo-IOs`,
		name: `Disconnected input`,
		type: 'button',
		style: {
			text: `NO INPUT`,
			size: '18',
			color: combineRgb(128, 128, 128),
			bgcolor: combineRgb(0, 0, 0),
		},
		feedbacks: [
			{
				feedbackId: `selected_in`,
				style: {
					bgcolor: combineRgb(255, 255, 255),
					color: combineRgb(0, 0, 0),
				},
				options: {
					io_key: 'NILIO',
				},
			},
			{
				feedbackId: `take_tally_in`,
				style: {
					bgcolor: combineRgb(255, 0, 0),
					color: combineRgb(255, 255, 255),
				},
				options: {
					io_key: 'NILIO',
				},
			},
		],
		steps: [
			{
				down: [
					{
						actionId: `select_in`,
						options: {
							io_key: 'NILIO',
						},
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

		const options = {
			io_key: io.key,
		}

		const dproto = io.displayProto()

		const feedbacks: CompanionPresetFeedback[] = [
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
			{
				feedbackId: 'signal_active',
				options: options,
			},
		]

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
			feedbacks: feedbacks,
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

	for (const n of self.nodes) {
		presets[`trunk_popt_E${n.ember_id}`] = {
			category: `Status info`,
			name: `Trunk RX optical power for ${n.name}`,
			type: 'button',
			style: {
				text: `TRUNKS $(stageracer:node_name_E${n.ember_id})`,
				size: '14',
				alignment: 'center:top',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			feedbacks: [
				{
					feedbackId: 'trunk_rx_popt',
					options: {
						ember_id: n.ember_id,
					},
				},
			],
			steps: [],
		}

		presets[`temp_E${n.ember_id}`] = {
			category: `Status info`,
			name: `Temperature status for ${n.name}`,
			type: 'button',
			style: {
				text: `TEMP $(stageracer:node_name_E${n.ember_id})`,
				size: '14',
				alignment: 'center:top',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			feedbacks: [
				{
					feedbackId: 'node_temp',
					options: {
						ember_id: n.ember_id,
					},
				},
			],
			steps: [],
		}

		presets[`psu_E${n.ember_id}`] = {
			category: `Status info`,
			name: `Power supply status for ${n.name}`,
			type: 'button',
			style: {
				text: `PSU $(stageracer:node_name_E${n.ember_id})`,
				size: '14',
				alignment: 'center:top',
				color: combineRgb(255, 255, 255),
				bgcolor: combineRgb(0, 0, 0),
			},
			feedbacks: [
				{
					feedbackId: 'node_psu',
					options: {
						ember_id: n.ember_id,
					},
				},
			],
			steps: [],
		}
	}

	self.setPresetDefinitions(presets)
}
