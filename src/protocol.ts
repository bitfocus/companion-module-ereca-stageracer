import { InstanceStatus } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { Agent, fetch, RequestInit, Response } from 'undici'

export class RacerProto {
	module: ModuleInstance
	reconnect_tout: NodeJS.Timeout | undefined = undefined
	poll_tout: NodeJS.Timeout | undefined = undefined
	mode: string = 'standard'
	ios: { [key: IoKey]: IoData } = {}

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
			await self.updateStatus(InstanceStatus.Disconnected, 'Host or API token missing')
			return
		}

		try {
			await self.updateStatus(InstanceStatus.Connecting)
			const req = await this.fetch('/api/meta')

			let res = (await req.json()) as ApiMeta

			if (res.protocol !== 'SR2-API-1.0') {
				throw new Error(`Invalid API version ${res.protocol}`)
			}

			if (!['standard', 'simulator'].includes(res.mode)) {
				throw new Error(`Unsupported API mode ${res.mode}`)
			}
			this.mode = res.mode

			await self.updateStatus(InstanceStatus.Ok, `${self.config.host}: ${res.version}`)
		} catch (e) {
			await self.updateStatus(InstanceStatus.Disconnected, `login failed: ${e}`)

			this.reconnect_tout = setTimeout(() => this.init(), 3000)
			return
		}

		this.pollTransient()
	}

	public async pollTransient() {
		const self = this.module

		if (this.poll_tout) {
			clearTimeout(this.poll_tout)
			this.poll_tout = undefined
		}

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

			this.module.updatePorts()
		}

		// Recursively call this method after the polling interval
		if (this.poll_tout) {
			clearTimeout(this.poll_tout)
		}
		this.poll_tout = setTimeout(() => this.pollTransient(), this.module.config.pollInterval)
	}

	addIo(node: Node, parent_proto: Protocol, io: Io, indices: number[]) {
		const iod = new IoData(node, io, parent_proto, indices)

		const dir = iod.direction()

		if (!iod.enabled || (dir !== 'IN' && dir !== 'OUT')) {
			return
		}

		// We only care about DANTE_CH protocols, not the DANTE dummy node
		if (iod.protocol !== 'DANTE') {
			this.ios[iod.key] = iod
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
		method: string = 'GET',
		content_type: string = 'application/json',
	): Promise<Response> {
		const self = this.module
		const prefix = self.config.useHttps ? 'https://' : 'http://'
		const host = self.config.host
		const url = `${prefix}${host}${endpoint}`

		const fetchopts: RequestInit = {
			method: method,
			headers: {
				'Content-Type': content_type,
				Authorization: `Bearer ${self.config.apiToken}`,
			},
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
			await self.updateStatus(InstanceStatus.Disconnected, '${res.statusText}')
		}

		return res
	}

	public async fetchNode(nid: NodeId): Promise<void> {
		const req = await this.fetch('/srnet/node?' + new URLSearchParams({ id: nid }).toString())

		const node = (await req.json()) as Node
		this.nodes[nid] = node

		this.module.log('debug', `Fetched ${nid} '${node.name}'`)
	}
}

export type NodeId = string
export type SyncToken = number
export type Protocol = string
export type Path = string
export type Priority = string
export type OutputSource = 'none' | ['locked' | 'unlocked', Path]
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
}

export type IoKey = string

export class IoData {
	io: Io
	key: IoKey
	desc: string
	node_id: NodeId
	name: string

	public get enabled(): boolean {
		return this.io.en
	}

	public get protocol(): Protocol {
		return this.io.proto
	}

	constructor(node: Node, io: Io, parent_proto: Protocol, indices: number[]) {
		this.io = io
		this.key = `E${node.ember_id}_${parent_proto}_${indices.join('_')}`
		this.desc = `${node.name}/${parent_proto}/${indices.join('/')}`
		this.node_id = node.id
		this.name = io.name

		if (!this.name) {
			this.name = `${this.displayProto()} ${indices.join('/')}`
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

}
