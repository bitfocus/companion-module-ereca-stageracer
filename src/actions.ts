import type { CompanionActionDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

export function UpdateActions(self: ModuleInstance): void {
	const actions: CompanionActionDefinitions = {}

        const choices_out = self.outputChoices();

	actions['select_out'] = {
		name: 'Select output port',
		options: [
			{
				type: 'dropdown',
				label: 'Destination',
				id: 'io_key',
				choices: choices_out,
                                default: 'NILIO'
			},
		],
		callback: (action) => {
                    const key = action.options.io_key
                    if (!key || typeof key !== 'string') {
                        console.error(action);
                        return;
                    }

                    self.selected_destination = key

                    self.checkFeedbacks('selected_out', 'take_tally_source', 'selected_source')

			// const values: CompanionVariableValues = {}
			// updateSelectedDestinationVariables(state, values)
			// self.setVariableValues(values)
		},
	}

	self.setActionDefinitions(actions)
}
