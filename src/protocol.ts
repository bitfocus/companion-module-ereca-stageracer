import { InstanceStatus } from '@companion-module/base'
import type { ModuleInstance } from './main.js'
import { Agent, fetch, RequestInit, Response } from 'undici'

export class RacerProto {
	module: ModuleInstance
	reconnect_tout: NodeJS.Timeout | undefined = undefined
	poll_tout: NodeJS.Timeout | undefined = undefined
	mode: string = 'standard'

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
		const module = this.module

		this.nodes = {}

		if (this.reconnect_tout) {
			clearTimeout(this.reconnect_tout)
			this.reconnect_tout = undefined
		}

		if (!module.config.host || !module.config.apiToken) {
			await module.updateStatus(InstanceStatus.Disconnected, 'Host or API token missing')
			return
		}

		try {
			await module.updateStatus(InstanceStatus.Connecting)
			const req = await this.fetch('/api/meta')

			let res = (await req.json()) as ApiMeta

			if (res.protocol !== 'SR2-API-1.0') {
				throw new Error(`Invalid API version ${res.protocol}`)
			}

			if (!['standard'].includes(res.mode)) {
				throw new Error(`Unsupported API mode ${res.mode}`)
			}
			this.mode = res.mode

			await module.updateStatus(InstanceStatus.Ok, `${module.config.host}: ${res.version}`)
		} catch (e) {
			console.log(e)
			await module.updateStatus(InstanceStatus.Disconnected, `login failed: ${e}`)

			this.reconnect_tout = setTimeout(() => this.init(), 3000)
			return
		}

		this.pollTransient()
	}

	public async pollTransient() {
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
				this.module.log('debug', `Dropping node ${nid}`)
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
		}

		if (needs_port_refresh) {
			this.module.updatePorts()
		}

		// Recursively call this method after the polling interval
		if (this.poll_tout) {
			clearTimeout(this.poll_tout)
		}
		this.poll_tout = setTimeout(() => this.pollTransient(), this.module.config.pollInterval)
	}

	public async fetch(
		endpoint: string,
		method: string = 'GET',
		content_type: string = 'application/json',
	): Promise<Response> {
		const prefix = this.module.config.useHttps ? 'https://' : 'http://'
		const host = this.module.config.host
		const url = `${prefix}${host}${endpoint}`

		const fetchopts: RequestInit = {
			method: method,
			headers: {
				'Content-Type': content_type,
				Authorization: `Bearer ${this.module.config.apiToken}`,
			},
		}

		// We accept self-signed certificates, unless we're connecting to
		// the sim env
		if (this.module.config.useHttps && host !== 'sim.ereca.fr') {
			fetchopts.dispatcher = new Agent({
				connect: {
					rejectUnauthorized: false,
				},
			})
		}

		// this.module.log('debug', `${fetchopts.method} ${url}`)

		let res = await fetch(url, fetchopts)

		if (!res.ok) {
			throw new Error(`${fetchopts.method} ${url} failed: ${res.status} ${res.statusText}`)
			await this.module.updateStatus(InstanceStatus.Disconnected, '${res.statusText}')
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

export function ioDir(io: Io): string {
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
