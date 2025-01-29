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
