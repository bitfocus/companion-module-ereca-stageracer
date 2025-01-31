import type { CompanionActionDefinitions, CompanionActionInfo } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { UpdateSelectionVariables } from './variables.js'

export function UpdateActions(self: ModuleInstance): void {
	const actions: CompanionActionDefinitions = {}

	const choices_out = self.outputChoices()
	const choices_in = self.inputChoices()

	choices_in.push({
		id: 'NILIO',
		label: '[NO INPUT]',
	})

	actions['take'] = {
		name: 'Take',
		options: [],
		callback: () => {
			self.applyPendingRoute()
		},
	}

	actions['clear'] = {
		name: 'Clear',
		options: [],
		callback: () => {
			self.clearPendingRoute()
		},
	}

	actions['select_out'] = {
		name: 'Select output port',
		options: [
			{
				type: 'dropdown',
				label: 'Destination',
				id: 'io_key',
				choices: choices_out,
				default: 'NILIO',
			},
		],
		callback: (action) => {
			const key = action.options.io_key
			if (!key || typeof key !== 'string') {
				console.error(action)
				return
			}

			self.setSelectedDestination(key)

			UpdateSelectionVariables(self)
		},
	}

	actions['select_in'] = {
		name: 'Select input port',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'io_key',
				choices: choices_in,
				default: 'NILIO',
			},
		],
		callback: async (action) => {
			const key = action.options.io_key
			if (!key || typeof key !== 'string') {
				console.error(action)
				return
			}

			const dst_io = self.selectedDestinationIo()
			if (!dst_io) {
				return
			}

			if (key === 'NILIO') {
				self.queueDisconnect(dst_io)
			} else {
				const src_io = self.ios[key]
				if (!src_io) {
					return
				}

				await self.queueRoute(src_io, dst_io)
			}
		},
	}

	const action_route = (action: CompanionActionInfo) => {
		const src_key = action.options.src_key
		const dst_key = action.options.dst_key

		if (!src_key || typeof src_key !== 'string') {
			console.error(action)
			return
		}

		if (!dst_key || typeof dst_key !== 'string') {
			console.error(action)
			return
		}

		const src_io = self.ios[src_key]
		const dst_io = self.ios[dst_key]

		if (!dst_io) {
			return
		}

		if (src_key == 'NILIO' || !src_io) {
			self.queueDisconnect(dst_io)
		} else {
			self.queueRoute(src_io, dst_io)
		}
	}

	actions['route'] = {
		name: 'Route source to destination. If take is enabled, set route pending.',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'src_key',
				default: 'NILIO',
				choices: choices_in,
			},
			{
				type: 'dropdown',
				label: 'Destination',
				id: 'dst_key',
				default: choices_out[0]?.id,
				choices: choices_out,
			},
		],
		callback: action_route,
	}

	actions['route_forced'] = {
		name: 'Route source to destination. Bypasses take.',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'src_key',
				default: 'NILIO',
				choices: choices_in,
			},
			{
				type: 'dropdown',
				label: 'Destination',
				id: 'dst_key',
				default: choices_out[0]?.id,
				choices: choices_out,
			},
		],
		callback: (action) => {
			action_route(action)
			self.applyPendingRoute()
		},
	}
	self.setActionDefinitions(actions)
}
