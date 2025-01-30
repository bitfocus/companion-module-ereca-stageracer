import { combineRgb, CompanionFeedbackDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

export function UpdateFeedbacks(self: ModuleInstance): void {
	const feedbacks: CompanionFeedbackDefinitions = {}

	const choices_out = self.outputChoices()
	const choices_in = self.inputChoices()

	feedbacks['take'] = {
		type: 'boolean',
		name: 'Change background color if take has a route queued',
		description: 'If a route is queued for take, change background color of the bank',
		defaultStyle: {
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(255, 0, 0),
		},
		options: [],
		callback: () => {
			return !!self.pendingRoute
		},
	}

	feedbacks['selected_in'] = {
		type: 'boolean',
		name: 'Change background color by route to selected destination',
		description: 'If the input specified is in use by the selected output, change background color of the bank',
		defaultStyle: {
			color: combineRgb(0, 0, 0),
			bgcolor: combineRgb(255, 255, 255),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Input',
				id: 'io_key',
				default: 0,
				choices: choices_in,
			},
		],
		callback: (feedback) => {
			const dst_io = self.selectedDestinationIo()

			if (!dst_io || !dst_io.src_key) {
				return false
			}

			return feedback.options.io_key == dst_io.src_key
		},
	}

	feedbacks['selected_out'] = {
		type: 'boolean',
		name: 'Change background color by selected destination',
		description: 'If the output specified is selected, change background color of the bank',
		defaultStyle: {
			color: combineRgb(0, 0, 0),
			bgcolor: combineRgb(255, 255, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Output',
				id: 'io_key',
				default: 0,
				choices: choices_out,
			},
		],
		callback: (feedback) => {
			return feedback.options.io_key == self.selectedDestination
		},
	}

	feedbacks['take_tally_in'] = {
		type: 'boolean',
		name: 'Change background color if the selected source is queued in take',
		description: 'If the selected source is queued for take, change background color of the bank',
		defaultStyle: {
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(255, 0, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Input',
				id: 'io_key',
				default: 0,
				choices: choices_in,
			},
		],
		callback: (feedback) => {
			if (!self.pendingRoute) {
				return false
			}

			if (self.selectedDestination !== self.pendingRoute.dst) {
				return false
			}

			return feedback.options.io_key == self.pendingRoute.src
		},
	}

	feedbacks['take_tally_out'] = {
		type: 'boolean',
		name: 'Change background color if the selected destination is queued in take',
		description: 'If the selected destination is queued for take, change background color of the bank',
		defaultStyle: {
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(255, 0, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Output',
				id: 'io_key',
				default: 0,
				choices: choices_out,
			},
		],
		callback: (feedback) => {
			if (!self.pendingRoute) {
				return false
			}

			return feedback.options.io_key == self.pendingRoute.dst
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}
