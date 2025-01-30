import type { CompanionActionDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

export function UpdateActions(self: ModuleInstance): void {
	const actions: CompanionActionDefinitions = {}

	const choices_out = self.outputChoices()
	const choices_in = self.inputChoices()

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

			// const values: CompanionVariableValues = {}
			// updateSelectedDestinationVariables(state, values)
			// self.setVariableValues(values)
		},
	}

	actions['select_in'] = {
		name: 'Select input port',
		options: [
			{
				type: 'dropdown',
				label: 'Destination',
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

			const src_io = self.ios[key]
			const dst_io = self.selectedDestinationIo()
			if (!src_io || !dst_io) {
				return
			}

			await self.queueRoute(src_io, dst_io)

			// const values: CompanionVariableValues = {}
			// updateSelectedDestinationVariables(state, values)
			// self.setVariableValues(values)
		},
	}

	self.setActionDefinitions(actions)
}
