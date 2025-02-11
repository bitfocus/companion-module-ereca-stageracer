import { combineRgb, CompanionFeedbackDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { graphics } from 'companion-module-utils'

export function UpdateFeedbacks(self: ModuleInstance): void {
	const feedbacks: CompanionFeedbackDefinitions = {}

	const choices_out = self.outputChoices()
	const choices_in = self.inputChoices()
	const choices_nodes = self.nodeChoices()

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

	feedbacks['trunk_rx_popt'] = {
		type: 'advanced',
		name: 'Trunk RX optical power',
		description: 'Draws meters representing the current trunk RX popt',
		options: [
			{
				type: 'dropdown',
				label: 'Node',
				id: 'ember_id',
				default: 0,
				choices: choices_nodes,
			},
		],
		callback: (feedback) => {
			const iw = feedback.image?.width || 10
			const ih = feedback.image?.height || 10

			const ember_id = feedback.options.ember_id
			if (!ember_id || typeof ember_id !== 'number') {
				return {}
			}

			const n = self.nodeByEmberId(ember_id)
			if (!n) {
				return {}
			}

			let popt: [number, number, number, number][] = []

			if (self.protocol.mode != 'simulator') {
				if (!n?.status) {
					return {}
				}

				popt = n?.status.controller_status.trunk_popt
			}

			const bars = ['A', 'B', 'C', 'D'].map((_t, i) => {
				let tpopt = Math.min(...(popt[i] || [-40]))

				if (tpopt < -40) {
					tpopt = -40
				}

				if (tpopt > 0) {
					tpopt = 0
				}

				const v = Math.pow((40 + tpopt) / 40, 2)

				return graphics.bar({
					width: iw,
					height: ih,
					colors: [
						{ size: 40, color: combineRgb(255, 0, 0), background: combineRgb(255, 0, 0), backgroundOpacity: 64 },
						{ size: 20, color: combineRgb(255, 255, 0), background: combineRgb(255, 255, 0), backgroundOpacity: 64 },
						{ size: 40, color: combineRgb(0, 255, 0), background: combineRgb(0, 255, 0), backgroundOpacity: 64 },
					],
					barLength: Math.trunc(ih / 2.1),
					barWidth: Math.trunc(iw / 8),
					value: Math.round(v * 100),
					type: 'vertical',
					reverse: false,
					offsetX: Math.trunc(iw / 16 + (iw / 4) * i),
					offsetY: Math.trunc(ih / 2),
					opacity: 255,
				})
			})

			return {
				imageBuffer: graphics.stackImage(bars),
			}
		},
	}

	feedbacks['node_temp'] = {
		type: 'advanced',
		name: 'Node temperature',
		description: 'Draws meters representing various temperature measurements',
		options: [
			{
				type: 'dropdown',
				label: 'Node',
				id: 'ember_id',
				default: 0,
				choices: choices_nodes,
			},
		],
		callback: (feedback) => {
			const iw = feedback.image?.width || 10
			const ih = feedback.image?.height || 10

			const ember_id = feedback.options.ember_id
			if (!ember_id || typeof ember_id !== 'number') {
				return {}
			}

			const n = self.nodeByEmberId(ember_id)
			if (!n) {
				return {}
			}

			let temps = [0, 0, 0, 0, 0, 0]

			if (self.protocol.mode != 'simulator') {
				if (!n?.status) {
					return {}
				}

				const cst = n.status.controller_status

				temps = [cst.temp_fpga, cst.temp_mb, cst.trunk_temp[0], cst.trunk_temp[1], cst.trunk_temp[2], cst.trunk_temp[3]]
			}

			const ntemps = temps.length

			const bars = temps.map((temp, i) => {
				temp = Math.round(temp)

				if (temp > 100) {
					temp = 100
				} else if (temp < 0) {
					temp = 0
				}

				return graphics.bar({
					width: iw,
					height: ih,
					colors: [
						{ size: 60, color: combineRgb(0, 255, 0), background: combineRgb(0, 255, 0), backgroundOpacity: 64 },
						{ size: 20, color: combineRgb(255, 255, 0), background: combineRgb(255, 255, 0), backgroundOpacity: 64 },
						{ size: 20, color: combineRgb(255, 0, 0), background: combineRgb(255, 0, 0), backgroundOpacity: 64 },
					],
					barLength: Math.trunc(ih / 2.1),
					barWidth: Math.trunc(iw / (ntemps * 2)),
					value: temp,
					type: 'vertical',
					reverse: false,
					offsetX: Math.trunc(iw / (ntemps * 4) + (iw / ntemps) * i),
					offsetY: Math.trunc(ih / 2),
					opacity: 255,
				})
			})

			return {
				imageBuffer: graphics.stackImage(bars),
			}
		},
	}

	feedbacks['node_psu'] = {
		type: 'advanced',
		name: 'Node power supply status',
		description: 'Draws two circles representing the status of both PSUs',
		options: [
			{
				type: 'dropdown',
				label: 'Node',
				id: 'ember_id',
				default: 0,
				choices: choices_nodes,
			},
		],
		callback: (feedback) => {
			const iw = feedback.image?.width || 10
			const ih = feedback.image?.height || 10

			const ember_id = feedback.options.ember_id
			if (!ember_id || typeof ember_id !== 'number') {
				return {}
			}

			const n = self.nodeByEmberId(ember_id)
			if (!n) {
				return {}
			}

			let psus_v = [12, 12]

			if (self.protocol.mode != 'simulator') {
				if (!n?.status) {
					return {}
				}

				const cst = n.status.controller_status

				psus_v = [cst.vpsu1, cst.vpsu2]
			}

			const bars = psus_v.map((v, i) => {
				let color = combineRgb(255, 0, 0)
				if (v > 11.7) {
					color = combineRgb(0, 255, 0)
				} else if (v > 11.5) {
					color = combineRgb(255, 255, 0)
				}

				const radius = Math.round(iw / 6)
				const options = {
					radius: radius,
					color: color,
					opacity: 255,
				}

				const circle = graphics.circle(options)

				return graphics.icon({
					width: iw,
					height: ih,
					custom: circle,
					type: 'custom',
					customHeight: 2 * radius,
					customWidth: 2 * radius,
					offsetX: (iw / 2) * i + 4,
					offsetY: Math.trunc(iw * 0.6),
				})
			})

			return {
				imageBuffer: graphics.stackImage(bars),
			}
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}
