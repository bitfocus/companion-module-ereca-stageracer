import { combineRgb, CompanionFeedbackDefinitions } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

export function UpdateFeedbacks(self: ModuleInstance): void {
	const feedbacks: CompanionFeedbackDefinitions = {}

	const choices_out = self.outputChoices()

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
				id: 'output',
				default: 0,
				choices: choices_out,
			},
		],
		callback: (feedback) => {
			return feedback.options.io_key == self.selected_destination
		},
	}

	self.setFeedbackDefinitions(feedbacks)
}
