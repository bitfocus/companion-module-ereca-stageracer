import { InstanceStatus } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { Agent, fetch, RequestInit, Response } from 'undici'

export class RacerProto {
	module: ModuleInstance
	reconnect_tout: NodeJS.Timeout | undefined = undefined
	poll_tout: NodeJS.Timeout | undefined = undefined
	mode: string = 'standard'
	ios: { [key: IoKey]: IoData } = {}
	iokey_by_path: { [key: Path]: IoKey } = {}

	nodes: { [key: NodeId]: Node } = {}

	constructor(module: ModuleInstance) {
		this.module = module
	}

	public destroy() {
		if (this.reconnect_tout) {
			clearTimeout(this.reconnect_tout)
			this.reconnect_tout = undefined
		}

		if (this.poll_tout) {
			clearTimeout(this.poll_tout)
			this.poll_tout = undefined
		}
	}

	public async init(): Promise<void> {
		const self = this.module

		this.nodes = {}

		if (this.reconnect_tout) {
			clearTimeout(this.reconnect_tout)
			this.reconnect_tout = undefined
		}

		if (!self.config.host || !self.config.apiToken) {
			await self.setStatus(InstanceStatus.Disconnected, 'Host or API token missing')
			return
		}

		try {
			await self.setStatus(InstanceStatus.Connecting)
			const req = await this.fetch('/api/meta')

			let res = (await req.json()) as ApiMeta

			if (res.protocol !== 'SR2-API-1.0') {
				throw new Error(`Invalid API version ${res.protocol}`)
			}

			if (!['standard', 'simulator'].includes(res.mode)) {
				throw new Error(`Unsupported API mode ${res.mode}`)
			}
			this.mode = res.mode

			await self.setStatus(InstanceStatus.Ok, `${self.config.host}: ${res.version}`)
		} catch (e) {
			await self.setStatus(InstanceStatus.Disconnected, `login failed: ${e}`)

			this.reconnect_tout = setTimeout(() => this.init(), 3000)
			return
		}

		this.pollTransient()
	}

	async pollTransient() {
		const self = this.module

		if (this.poll_tout) {
			clearTimeout(this.poll_tout)
			this.poll_tout = undefined
		}

		try {
			await this.fetchTransient()
			await self.setStatus(InstanceStatus.Ok)
		} catch (e) {
			self.log('error', `Failed to process transient data: ${e}`)
			await self.setStatus(InstanceStatus.Disconnected, `${e}`)
		}

		// Recursively call this method after the polling interval
		this.scheduleTransient(self.config.pollInterval)
	}

	async scheduleTransient(delay_ms: number) {
		if (this.poll_tout) {
			clearTimeout(this.poll_tout)
		}
		this.poll_tout = setTimeout(() => this.pollTransient(), delay_ms)
	}

	async fetchTransient() {
		const self = this.module

		const req = await this.fetch('/srnet/transient')

		const transient = (await req.json()) as Transient

		const node_tokens = transient.node_tokens

		let needs_port_refresh = false

		let nodes_to_fetch = []

		// Look for dropped nodes
		for (const nid of Object.keys(this.nodes)) {
			if (!node_tokens.find((t) => t[0] == nid)) {
				delete this.nodes[nid]
				needs_port_refresh = true
				self.log('debug', `Dropping node ${nid}`)
			}
		}

		for (const [nid, stoken] of node_tokens) {
			const node = this.nodes[nid]

			if (!node || node.sync_token !== stoken) {
				nodes_to_fetch.push(nid)
			}
		}

		if (this.mode == 'standard') {
			// Fetch one node at a time
			for (const nid of nodes_to_fetch) {
				await this.fetchNode(nid)
				needs_port_refresh = true
			}
		} else if (this.mode == 'simulator') {
			if (nodes_to_fetch.length) {
				// with the simulator we always fetch all nodes at once
				const req = await this.fetch('/srnet/nodes')

				this.nodes = (await req.json()) as { [key: NodeId]: Node }
				needs_port_refresh = true
			}
		}

		if (needs_port_refresh) {
			// Reload all IOs.
			//
			// XXX Maybe we could use partial updates for performance?
			this.ios = {}
			this.iokey_by_path = {}

			const proto_filter = self.protoFilter

			for (const node of Object.values(this.nodes)) {
				const protos = Object.keys(node.ios_by_proto)
					.filter((proto) => !proto_filter.some((pf) => proto.includes(pf)))
					.sort()

				for (const proto of protos) {
					const ios = node.ios_by_proto[proto]

					for (const [idx, io] of ios.entries()) {
						this.addIo(node, proto, io, [idx + 1])
					}
				}
			}

			// Refresh source keys
			for (const io of Object.values(this.ios)) {
				const src_path = io.sourcePath()

				if (!src_path) {
					continue
				}

				const src_key = this.iokey_by_path[src_path]

				if (!src_key) {
					continue
				}
				io.src_key = src_key
			}

			this.module.updatePorts()
		}
	}

	addIo(node: Node, parent_proto: Protocol, io: Io, indices: number[]) {
		const iod = new IoData(node, io, parent_proto, indices)

		const dir = iod.direction()

		if (!iod.enabled || (dir !== 'IN' && dir !== 'OUT')) {
			return
		}

		// We only care about DANTE_CH protocols, not the DANTE dummy node
		if (iod.protocol !== 'DANTE' && iod.protocol !== 'GENLOCK') {
			this.ios[iod.key] = iod
			this.iokey_by_path[iod.path] = iod.key
		}

		// Recursively add children
		for (const [idx, cio] of io.children.entries()) {
			const cidx = indices.slice()
			cidx.push(idx + 1)

			this.addIo(node, parent_proto, cio, cidx)
		}
	}

	public async fetch(
		endpoint: string,
		opts: {
			method?: 'GET' | 'POST'
			body?: any
		} = {},
	): Promise<Response> {
		const self = this.module
		const prefix = self.config.useHttps ? 'https://' : 'http://'
		const host = self.config.host
		const url = `${prefix}${host}${endpoint}`

		const headers = new Headers({
			Authorization: `Bearer ${self.config.apiToken.trim()}`,
		})

		const fetchopts: RequestInit = {
			method: opts.method ?? 'GET',
			headers: headers,
		}

		if (opts.body) {
			headers.set('Content-Type', 'application/json')
			fetchopts.body = JSON.stringify(opts.body)
		}

		// We accept self-signed certificates, unless we're connecting to
		// the sim env
		if (self.config.useHttps && host !== 'sim.ereca.fr') {
			fetchopts.dispatcher = new Agent({
				connect: {
					rejectUnauthorized: false,
				},
			})
		}

		// self.log('debug', `${fetchopts.method} ${url}`)

		let res = await fetch(url, fetchopts)

		if (!res.ok) {
			throw new Error(`${fetchopts.method} ${url} failed: ${res.status} ${res.statusText}`)
		}

		return res
	}

	public async fetchNode(nid: NodeId): Promise<void> {
		const req = await this.fetch('/srnet/node?' + new URLSearchParams({ id: nid }).toString())

		const node = (await req.json()) as Node
		this.nodes[nid] = node

		this.module.log('debug', `Fetched ${nid} '${node.name}'`)
	}

	public async route(src: IoData, dst: IoData) {
		const self = this.module
		const xpoint = {
			input: src.path,
			output: dst.path,
		}

		const xpoint_action = {
			action: 'create',
			points: [xpoint],
		}

		try {
			await this.fetch('/srnet/grid/crosspoints', {
				method: 'POST',
				body: xpoint_action,
			})
		} catch (e) {
			self.log('error', `Failed to create crosspoint ${xpoint.input} -> ${xpoint.output}: ${e}`)
		}

		// Schedule a poll in short notice to refresh our routes etc
		this.scheduleTransient(200)
	}

	public async disconnect(dst: IoData) {
		const self = this.module
		const xpoint = {
			input: dst.sourcePath(),
			output: dst.path,
		}

		const xpoint_action = {
			action: 'delete',
			points: [xpoint],
		}

		try {
			await this.fetch('/srnet/grid/crosspoints', {
				method: 'POST',
				body: xpoint_action,
			})
		} catch (e) {
			self.log('error', `Failed to create crosspoint ${xpoint.input} -> ${xpoint.output}: ${e}`)
		}

		// Schedule a poll in short notice to refresh our routes etc
		this.scheduleTransient(200)
	}
}

export type NodeId = string
export type SyncToken = number
export type Protocol = string
export type Path = string
export type Priority = string
export type TicoMode = string
export type Standard = { name: string; bw: number }
export type OutputSource = 'none' | { locked?: Path; unlocked?: Path }
export type IoDirection = string | { OUT?: [OutputSource, Priority]; BIDIR?: [OutputSource, Priority] }

type ApiMeta = {
	protocol: string
	version: string
	mode: string
}

type Transient = {
	local_node_id: NodeId
	root_node_id: NodeId
	routing_token: SyncToken
	node_tokens: [NodeId, SyncToken][]
}

export type Node = {
	name: string
	id: NodeId
	sync_token: number
	ios_by_proto: { [key: Protocol]: Io[] }
	ember_id: number
}

export type Io = {
	name: string
	en: boolean
	proto: Protocol
	dir: IoDirection
	children: Io[]
	attrs: Object | any
	stds: Standard[]
	stdi: number
}

export type IoKey = string

export class IoData {
	io: Io
	key: IoKey
	desc: string
	node_id: NodeId
	name: string
	path: Path
	src_key: IoKey | undefined
	active_standard: Standard | undefined

	public get enabled(): boolean {
		return this.io.en
	}

	public get protocol(): Protocol {
		return this.io.proto
	}

	constructor(node: Node, io: Io, parent_proto: Protocol, indices: number[]) {
		this.io = io
		this.key = `E${node.ember_id}_${parent_proto}_${indices.join('_')}`
		this.path = `${node.id}/${parent_proto}/${indices.join('/')}`
		this.desc = `${node.name}/${parent_proto}/${indices.join('/')}`
		this.node_id = node.id
		this.name = io.name

		if (!this.name) {
			this.name = `${this.displayProto()} ${indices.join('/')}`
		}

		if (io.stds) {
			this.active_standard = io.stds[io.stdi]
		}
	}

	public direction(): string {
		const io = this.io

		if (typeof io.dir === 'string') {
			return io.dir
		}

		if (io.dir.OUT) {
			return 'OUT'
		}

		if (io.dir.BIDIR) {
			return 'BIDIR'
		}

		return 'IDLE'
	}

	public sourcePath(): Path | undefined {
		const io = this.io

		if (typeof io.dir === 'string') {
			return undefined
		}

		const out_cfg = io.dir?.OUT ?? io.dir?.BIDIR

		if (!out_cfg || typeof out_cfg[0] == 'string') {
			return undefined
		}

		return out_cfg[0]?.locked ?? out_cfg[0]?.unlocked
	}

	public isInput(): boolean {
		return this.direction() == 'IN'
	}

	public isOutput(): boolean {
		return this.direction() == 'OUT'
	}

	public displayProto(): string {
		const proto_map: { [key: string]: string } = {
			ANALO_IN: 'ANALOG',
			ANALO_OUT: 'ANALOG',
			GPI: 'GPIO',
			GPO: 'GPIO',
			DANTE_CH: 'DANTE',
			SDI_PV: 'PREVIEW',
			SDI_ACH: 'SDI_AUDIO',
			GENLOCK: 'GL',
			MADI_CH: 'MADI_AUDIO',
		}

		return proto_map[this.protocol] || this.protocol
	}

	public getAttr(attr: string): any | undefined {
		if (this.io.attrs) {
			return this.io.attrs[attr]
		}
	}

	public ticoMode(): TicoMode {
		let attr = this.getAttr('sdi_input')

		if (attr) {
			return attr.tico_compression_mode
		}

		return 'DISABLED'
	}

	public activeStandardBw(): number | undefined {
		if (!this.active_standard) {
			return undefined
		}

		const bw = this.active_standard.bw

		switch (this.ticoMode()) {
			case 'TICO3G':
				switch (this.active_standard.name) {
					case 'HD':
					case '3G':
					case '6G':
					case '12G':
						return bw / 4
					default:
						return bw
				}

			case 'TICOHD':
				switch (this.active_standard.name) {
					case 'HD':
					case '3G':
					case '6G':
						return bw / 4
					case '12G':
						return bw / 8
					default:
						return bw
				}

			case null:
			case 'DISABLED':
			default:
				return bw
		}
	}

	public maxBwStandard(): Standard | undefined {
		return this.io.stds.reduce((max, current) => (current.bw > max.bw ? current : max))
	}

	public canStreamTo(dst: IoData): boolean {
		if (this.key == dst.key) {
			// Can't stream to ourselves
			return false
		}

		if (!this.isInput() || !dst.isOutput()) {
			return false
		}

		if (!this.enabled || !dst.enabled) {
			return false
		}

		const src_proto = this.protocol
		const dst_proto = dst.protocol

		if (dst_proto == 'SDI_PV' && src_proto == 'SDI') {
			return true
		}

		function areProtosCompatible(src: Protocol, dst: Protocol): boolean {
			const audio_out_protos = ['ANALO_OUT', 'SDI_ACH', 'MADI_CH', 'DANTE_CH', 'AES_CH']

			switch (src) {
				case 'GPI':
					return dst === 'GPO'
				case 'ANALO_IN':
				case 'SDI_ACH':
				case 'AES_CH':
				case 'MADI_CH':
				case 'DANTE_CH':
					return audio_out_protos.includes(dst)
				case 'AES':
				case 'MADI_AES_CH':
					return ['AES', 'MADI_AES_CH'].includes(dst)
				case 'SDI':
					return ['SDI', 'SDI_PV'].includes(dst)
				default:
					return src == dst
			}
		}

		if (!areProtosCompatible(src_proto, dst_proto)) {
			return false
		}

		// TODO: check TICO compat

		const in_bw = this.activeStandardBw()
		if (in_bw) {
			let out_max = dst.maxBwStandard()?.bw || 0

			// We can stream if our input bandwidth is less than our output
			// bandwidth
			if (in_bw > out_max) {
				return false
			}
		}

		return true
	}
}
