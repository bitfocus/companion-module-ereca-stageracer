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

		if (io.isOutput()) {
			vdef.push({
				name: `Label of input routed to ${io.desc}`,
				variableId: `io_source_${io.key}`,
			})

			let src_label = ''

			const source = io.sourcePath()
			if (source) {
				const src_io = self.protocol.ios[source]

				if (src_io) {
					src_label = src_io.name
				}
			}

			vval[`io_source_${io.key}`] = src_label
		}
	}

	for (const n of self.nodes) {
		vdef.push({
			name: `Label of node ${n.ember_id}`,
			variableId: `node_name_E${n.ember_id}`,
		})
		vval[`node_name_E${n.ember_id}`] = n.name

		vdef.push({
			name: `Voltage of ${n.name} PSU1`,
			variableId: `node_psu_E${n.ember_id}_1`,
		})
		vdef.push({
			name: `Voltage of ${n.name} PSU2`,
			variableId: `node_psu_E${n.ember_id}_2`,
		})

		vdef.push({
			name: `Motherboard temperature for ${n.name} (°C)`,
			variableId: `node_temp_E${n.ember_id}_mb`,
		})
		vdef.push({
			name: `FPGA temperature for ${n.name} (°C)`,
			variableId: `node_temp_E${n.ember_id}_fpga`,
		})
		vdef.push({
			name: `QSFP A temperature for ${n.name} (°C)`,
			variableId: `node_temp_E${n.ember_id}_qsfp_a`,
		})
		vdef.push({
			name: `QSFP B temperature for ${n.name} (°C)`,
			variableId: `node_temp_E${n.ember_id}_qsfp_b`,
		})
		vdef.push({
			name: `QSFP C temperature for ${n.name} (°C)`,
			variableId: `node_temp_E${n.ember_id}_qsfp_c`,
		})
		vdef.push({
			name: `QSFP D temperature for ${n.name} (°C)`,
			variableId: `node_temp_E${n.ember_id}_qsfp_d`,
		})

		for (const t of ['A', 'B', 'C', 'D']) {
			vdef.push({
				name: `Trunk ${t} RX optical power for ${n.name}`,
				variableId: `node_popt_E${n.ember_id}_trunk_${t.toLowerCase()}`,
			})
		}
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

export function UpdateTransientVariables(self: ModuleInstance): void {
	const vval: CompanionVariableValues = {}

	for (const n of self.nodes) {
		if (self.protocol.mode === 'simulator') {
			vval[`node_psu_E${n.ember_id}_1`] = 11.99
			vval[`node_psu_E${n.ember_id}_2`] = 11.9

			vval[`node_temp_E${n.ember_id}_mb`] = 30.5
			vval[`node_temp_E${n.ember_id}_fpga`] = 30.5
			vval[`node_temp_E${n.ember_id}_qsfp_a`] = 30.5
			vval[`node_temp_E${n.ember_id}_qsfp_b`] = 30.5
			vval[`node_temp_E${n.ember_id}_qsfp_c`] = 30.5
			vval[`node_temp_E${n.ember_id}_qsfp_d`] = 30.5

			for (const t of ['A', 'B', 'C', 'D']) {
				vval[`node_popt_E${n.ember_id}_trunk_${t.toLowerCase()}`] = -2.2
			}
		} else {
			if (!n?.status) {
				continue
			}

			const cst = n.status.controller_status

			vval[`node_psu_E${n.ember_id}_1`] = cst.vpsu1
			vval[`node_psu_E${n.ember_id}_2`] = cst.vpsu2

			vval[`node_temp_E${n.ember_id}_mb`] = cst.temp_mb
			vval[`node_temp_E${n.ember_id}_fpga`] = cst.temp_fpga
			vval[`node_temp_E${n.ember_id}_qsfp_a`] = cst.trunk_temp[0]
			vval[`node_temp_E${n.ember_id}_qsfp_b`] = cst.trunk_temp[1]
			vval[`node_temp_E${n.ember_id}_qsfp_c`] = cst.trunk_temp[2]
			vval[`node_temp_E${n.ember_id}_qsfp_d`] = cst.trunk_temp[3]
			;['A', 'B', 'C', 'D'].forEach((t, i) => {
				let tpopt = Math.min(...(cst.trunk_popt[i] || [-40]))

				if (tpopt < -40) {
					tpopt = -40
				}

				if (tpopt > 0) {
					tpopt = 0
				}

				vval[`node_popt_E${n.ember_id}_trunk_${t.toLowerCase()}`] = tpopt
			})
		}
	}

	self.setVariableValues(vval)
}
