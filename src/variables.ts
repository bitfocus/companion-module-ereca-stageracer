import type { ModuleInstance } from './main.js'
import type { CompanionVariableDefinition, CompanionVariableValues } from '@companion-module/base'

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const vdef: CompanionVariableDefinition[] = []
	const vval: CompanionVariableValues = {}

	for (const io of Object.values(self.ios)) {
		vdef.push({
			name: `Name of port ${io.desc}`,
			variableId: `io_name_${io.key}`,
		})

		vval[`io_name_${io.key}`] = io.name
	}

	self.setVariableDefinitions(vdef)
	self.setVariableValues(vval)
}
