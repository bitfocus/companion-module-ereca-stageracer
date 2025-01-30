import type { ModuleInstance } from './main.js'
import type { CompanionVariableDefinition, CompanionVariableValues } from '@companion-module/base'

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const vdef: CompanionVariableDefinition[] = []
	const vval: CompanionVariableValues = {}

	vdef.push({
		name: `In the simulator, contains the name of the config. Otherwise the name of the node Companion is connected to.`,
		variableId: `target_id`,
	})
	vval['target_id'] = self.protocol.meta?.identifier ?? self.protocol.localNode()?.name

	vdef.push({
		name: 'Label of the selected destination',
		variableId: 'selected_out',
	})
	vdef.push({
		name: 'Label of the input routed to the selected destination',
		variableId: 'selected_in',
	})

	for (const io of Object.values(self.ios)) {
		vdef.push({
			name: `Name of port ${io.desc}`,
			variableId: `io_name_${io.key}`,
		})

		vval[`io_name_${io.key}`] = io.name
	}

	self.setVariableDefinitions(vdef)
	self.setVariableValues(vval)

	UpdateSelectionVariables(self)
}

export function UpdateSelectionVariables(self: ModuleInstance): void {
	const vval: CompanionVariableValues = {}

	vval['selected_out'] = ''
	vval['selected_in'] = ''

	const dst_io = self.selectedDestinationIo()
	if (dst_io) {
		vval['selected_out'] = dst_io.name
		vval['selected_in'] = 'NO INPUT'

		if (dst_io.src_key) {
			const src_io = self.protocol.ios[dst_io.src_key]
			if (src_io) {
				vval['selected_in'] = src_io.name
			}
		}
	}

	self.setVariableValues(vval)
}
