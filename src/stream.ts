import {Duplex, finished} from 'stream'

import {createAsyncQueue, AsyncQueue} from 'pico-queue'
import type {WSSend} from 'ws-send'

import type {WSStreamPayload, WSStreamPayloadControl, WSStreamPayloadData, DOmit} from './types'
import {decode} from './util'

type WriteCallback = {
  (error?: Error | null): void
}

export class WSStream<T = any> extends Duplex {

  private shouldResolveCallbackOnWrite: boolean = true
  private writeCallbackQueue: WriteCallback[] = []
  private asyncQueue: AsyncQueue
  private finishedCleanUp?: () => void

  constructor(public wssend: WSSend<WSStreamPayload<T>>, public key: string, public isSource: boolean, public extraData?: T) {
    super()
    this.asyncQueue = createAsyncQueue()
    this.handleMessage = this.handleMessage.bind(this)
    this.handleSocketClose = this.handleSocketClose.bind(this)
    this.handleFinish = this.handleFinish.bind(this)
    if (!this.isClosed) {
      this.wssend.on('message', this.handleMessage)
      this.wssend.socket.on('close', this.handleSocketClose)
      this.finishedCleanUp = finished(this, this.handleFinish)
      if (isSource) {
        this.sendControl({type: 'create', value: this.extraData})
      }
    } else {
      this.destroy()
    }
  }

  private get isOpen() {
    return this.wssend.socket.readyState === this.wssend.socket.OPEN
  }

  private get isConnecting() {
    return this.wssend.socket.readyState === this.wssend.socket.CONNECTING
  }

  private get isClosed() {
    return this.wssend.socket.readyState === this.wssend.socket.CLOSED
  }

  private get isReachable() {
    return this.isConnecting || this.isOpen
  }

  private handleSocketClose() {
    this.handleFinish()
    this.destroy()
  }

  private handleFinish(err?: Error | null) {
    if (err && !this.destroyed) this.destroy()
    this.wssend.off('message', this.handleMessage)
    this.wssend.socket.off('close', this.handleSocketClose)
    this.finishedCleanUp?.()
  }

  private handleControl(data: WSStreamPayloadControl<T>['payload']) {
    if (data.type === 'canPushNext') {
      this.setWritingMode(data.value)
    }
    if (data.type === 'end') {
      this.pushToBuffer(null)
    }
    if (data.type === 'destroy') {
      if (!this.destroyed) {
        this.destroy()
      }
    }
  }

  private handleMessage(data: WSStreamPayload<T>) {
    if (!data) return
    if (typeof data !== 'object') return
    if (data.source !== 'ws-send-stream') return
    if (data.key !== this.key) return
    if (data.type === 'stream.data') {
      this.pushToBuffer(data.payload)
    }
    if (data.type === 'stream.control') {
      this.handleControl(data.payload)
    }
  }

  private sendAfterOpen(payload: WSStreamPayload<T>): Promise<void> {
    if (this.isConnecting) {
      return new Promise((resolve, reject) => {
        this.wssend.socket.once('open', () => {
          this.wssend.send(payload).then(resolve).catch(reject)
        })
      })
    }
    return this.wssend.send(payload)
  }

  private async send(data: DOmit<WSStreamPayload<T>, 'source' | 'key'>) {
    const payload: WSStreamPayload<T> = {
      source: 'ws-send-stream',
      key: this.key,
      ...data
    }
    return this.asyncQueue.push(() => this.sendAfterOpen(payload))
  }

  private async sendControl(payload: WSStreamPayloadControl<T>['payload']) {
    if (this.isReachable) {
      return this.send({type: 'stream.control', payload})
    }
  }

  private async sendData(payload: WSStreamPayloadData<T>['payload']) {
    return this.send({type: 'stream.data', payload})
  }

  public setWritingMode(canPushNext: boolean) {
    this.shouldResolveCallbackOnWrite = canPushNext
    if (this.shouldResolveCallbackOnWrite) {
      this.writeCallbackQueue.forEach(callback => callback())
      this.writeCallbackQueue = []
    }
  }

  public pushToBuffer(chunk: any) {
    if (this.destroyed) return
    const canPushNext = this.push(chunk)
    if (!canPushNext) {
      this.sendControl({type: 'canPushNext', value: false})
    }
  }

  _read() {
    this.sendControl({type: 'canPushNext', value: true})
  }

  async _write(chunk: any, encoding: BufferEncoding, callback: WriteCallback) {
    this._writev([{chunk, encoding}], callback)
  }

  async _writev(chunks: {chunk: any, encoding: BufferEncoding}[], callback: WriteCallback) {
    const chunk = Buffer.concat(chunks.map(({chunk, encoding}) => decode(chunk, encoding)))
    try {
      await this.sendData(chunk)
      if (this.shouldResolveCallbackOnWrite) {
        callback()
      } else {
        this.writeCallbackQueue.push(callback)
      }
    } catch(e) {
      callback(e || new Error())
    }
  }

  async _final(callback: (error?: Error | null) => void) {
    try {
      await this.sendControl({type: 'end'})
      callback()
    } catch(e) {
      callback(e || new Error())
    }
  }

  async _destroy(error: Error | null, callback: (error: Error | null) => void) {
    try {
      await this.sendControl({type: 'destroy'})
      callback(error)
    } catch(e) {
      callback(e || new Error())
    }
  }

}
