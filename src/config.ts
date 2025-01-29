import { type SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	host: string
	useHttps: boolean
	apiToken: string
	take: boolean
	protoFilter: string
	pollInterval: number
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'StageRacer host',
			width: 6,
			required: true,
		},
		{
			type: 'checkbox',
			id: 'useHttps',
			label: 'Use TLS (HTTPS)',
			width: 6,
			tooltip: 'If disabled, insecure HTTP connections will be used',
			default: true,
		},
		{
			type: 'textinput',
			id: 'apiToken',
			label: 'API token',
			width: 6,
			tooltip: 'API token starting with "SRK_" followed by a code',
			required: true,
			regex: '^SRK_[a-zA-Z0-9]{10,}$',
		},
		{
			type: 'number',
			id: 'pollInterval',
			label: 'API polling interval (ms)',
			width: 6,
			default: 1000,
			min: 250,
			max: 60 * 1000,
		},
		{
			type: 'textinput',
			id: 'protoFilter',
			label: 'Port types to ignore',
			width: 12,
			tooltip: 'Protocol names, separated with commas. e.g. "MADI,IP,GPI,GPO"',
		},
		{
			type: 'checkbox',
			id: 'take',
			label: 'Enable Take?',
			width: 6,
			default: false,
		},
	]
}
