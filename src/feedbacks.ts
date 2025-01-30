import { combineRgb, CompanionFeedbackDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

export function UpdateFeedbacks(self: ModuleInstance): void {
	const feedbacks: CompanionFeedbackDefinitions = {}

	const choices_out = self.outputChoices()
	const choices_in = self.inputChoices()

	feedbacks['take'] = {
		type: 'boolean',
		name: 'Take pending',
		description: 'Active if take has a route queued',
		defaultStyle: {
			color: combineRgb(255, 255, 255),
			bgcolor: combineRgb(255, 0, 0),
		},
		options: [],
		callback: () => {
			return !!self.pendingRoute
		},
	}

	feedbacks['take_incompatible'] = {
		type: 'boolean',
		name: 'Take pending incompatible',
		description: 'Active if a route is queued for take and the ports are incompatible',
		defaultStyle: {
			color: combineRgb(255, 0, 0),
			bgcolor: combineRgb(255, 200, 255),
			text: 'Take invalid',
		},
		options: [],
		callback: () => {
			if (!self.pendingRoute) {
				return false
			}
			return !self.pendingRoute.compatible
		},
	}

	feedbacks['selected_in'] = {
		type: 'boolean',
		name: 'Selected output source',
		description: 'Active if the input specified is routed to the selected output',
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
		name: 'Selected output',
		description: 'Active if the output specified is selected',
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
		name: 'Take source',
		description: 'Active if the selected source is queued for take',
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
		name: 'Take destination',
		description: 'Active If the selected destination is queued for take',
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
