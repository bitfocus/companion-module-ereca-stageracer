import { combineRgb, CompanionFeedbackDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { graphics } from 'companion-module-utils'

export function UpdateFeedbacks(self: ModuleInstance): void {
	const feedbacks: CompanionFeedbackDefinitions = {}

	const choices_out = self.outputChoices()
	const choices_in = self.inputChoices()

	choices_in.push({
		id: 'NILIO',
		label: '[NO INPUT]',
	})

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
			bgcolor: combineRgb(255, 200, 255),
			color: combineRgb(255, 0, 0),
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

			if (!dst_io) {
				return false
			}

			if (!dst_io.src_key) {
				return feedback.options.io_key == 'NILIO'
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

			if (!self.pendingRoute.src) {
				return feedback.options.io_key == 'NILIO'
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

	feedbacks['signal_active'] = {
		type: 'advanced',
		name: 'Port has a valid signal',
		description: 'Draw a green/orange dot if the port specified currently receives/transmits a valid signal',
		options: [
			{
				type: 'dropdown',
				label: 'Input',
				id: 'io_key',
				default: 0,
				choices: [...choices_in, ...choices_out],
			},
		],
		callback: (feedback) => {
			const io_key = feedback.options.io_key
			if (!io_key || typeof io_key !== 'string') {
				return {}
			}

			if (!self.protocol.active_ios.has(io_key)) {
				return {}
			}

			const io = self.ios[io_key]

			if (!io) {
				return {}
			}

			let color = combineRgb(14, 188, 0)
			if (io.isOutput()) {
				color = combineRgb(214, 200, 0)
			}

			const r = 6
			const options = {
				radius: r,
				color: color,
				opacity: 200,
			}

			const circle = graphics.circle(options)

			const circleIcon = graphics.icon({
				width: feedback.image?.width || 10,
				height: feedback.image?.height || 10,
				custom: circle,
				type: 'custom',
				customHeight: 2 * r,
				customWidth: 2 * r,
				offsetX: 3,
				offsetY: 3,
			})

			return {
				imageBuffer: circleIcon,
			}
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}
