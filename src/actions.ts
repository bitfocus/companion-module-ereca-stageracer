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
		callback: async () => {
			await self.applyPendingRoute()
		},
	}

	actions['clear'] = {
		name: 'Clear',
		options: [],
		callback: async () => {
			await self.clearPendingRoute()
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
				await self.queueDisconnect(dst_io)
			} else {
				const src_io = self.ios[key]
				if (!src_io) {
					return
				}

				await self.queueRoute(src_io, dst_io)
			}
		},
	}

	const action_route = async (action: CompanionActionInfo) => {
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
			await self.queueDisconnect(dst_io)
		} else {
			await self.queueRoute(src_io, dst_io)
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
		callback: async (action) => {
			await action_route(action)
			await self.applyPendingRoute()
		},
	}

	actions['rename'] = {
		name: 'Rename port',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'io_key',
				default: 'NILIO',
				choices: [...choices_in, ...choices_out],
			},
			{
				type: 'textinput',
				label: 'New label',
				id: 'label',
				default: '',
			},
		],
		callback: async (action) => {
			const key = action.options.io_key
			if (!key || typeof key !== 'string' || key == 'NILIO') {
				console.error(action)
				return
			}

			const label = `${action.options.label}`

			const io = self.ios[key]

			if (!io) {
				return
			}

			await self.protocol.renameIo(io, label)
		},
	}

	actions['set_source_tally'] = {
		name: 'Set source tally',
		description:
			'Set red, green, or amber tally for a source. Follows routing to destinations and updates multiviewer PIPs via TSL v5 (UDP 9801).',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'io_key',
				default: choices_in[0]?.id ?? 'NILIO',
				choices: choices_in.filter((c) => c.id !== 'NILIO'),
			},
			{
				type: 'dropdown',
				label: 'Colour',
				id: 'colour',
				default: 'red',
				choices: [
					{ id: 'red', label: 'Red' },
					{ id: 'green', label: 'Green' },
					{ id: 'amber', label: 'Amber' },
				],
			},
			{
				type: 'dropdown',
				label: 'State',
				id: 'state',
				default: 'true',
				choices: [
					{ id: 'true', label: 'On' },
					{ id: 'false', label: 'Off' },
				],
				allowCustom: true,
				tooltip: 'On/Off, or a variable/expression that resolves to true or false',
			},
		],
		callback: async (action, context) => {
			const key = action.options.io_key
			if (!key || typeof key !== 'string' || key === 'NILIO') {
				return
			}

			if (!self.ios[key]) {
				return
			}

			const colourRaw = action.options.colour
			const colour = colourRaw === 'green' || colourRaw === 'amber' ? colourRaw : 'red'

			const stateOpt = action.options.state
			let on: boolean
			if (typeof stateOpt === 'boolean') {
				on = stateOpt
			} else {
				const stateRaw = await context.parseVariablesInString(`${stateOpt ?? ''}`)
				const stateNorm = stateRaw.trim().toLowerCase()
				on = ['true', '1', 'on', 'yes'].includes(stateNorm)
			}

			self.tally.setSourceTally(key, colour, on)
		},
	}

	self.setActionDefinitions(actions)
}
