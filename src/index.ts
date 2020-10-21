import {finished} from 'stream'
import {EventEmitter} from 'events'

import type WebSocket from 'ws'
import {WSSend} from 'ws-send'

import type {WSStreamPayload} from './types'
import {generateId} from './util'
import {WSStream} from './stream'

type StreamHandler<T> = {
  (stream: WSStream<T>, extraData?: T): void
}

export declare interface WSSendStream<T = any> {
  on(event: 'stream', handler: StreamHandler<T>): this
}

export class WSSendStream<T = any> extends EventEmitter {

  public wssend: WSSend<WSStreamPayload<T>>
  public streams: Record<string, WSStream<T>> = {}

  constructor(public socket: WebSocket, public id?: string) {
    super()
    this.wssend = new WSSend(socket)
    this.handleMessage = this.handleMessage.bind(this)
    this.handleSocketClose = this.handleSocketClose.bind(this)
    if (!this.isClosed) {
      this.wssend.on('message', this.handleMessage)
      this.wssend.socket.on('close', this.handleSocketClose)
    }
  }

  private get isClosed() {
    return this.wssend.socket.readyState === this.wssend.socket.CLOSED
  }

  private handleSocketClose() {
    this.wssend.off('message', this.handleMessage)
    this.wssend.socket.off('close', this.handleSocketClose)
    this.removeAllListeners()
  }

  private handleMessage(data: WSStreamPayload<T>) {
    if (!data) return
    if (typeof data !== 'object') return
    if (data.source !== 'ws-send-stream') return
    if (data.type === 'stream.control') {
      if (data.payload.type === 'create') {
        if (!this.streams[data.key]) {
          const stream = this.createOrGetStreamForKey(data.key, false, data.payload.value)
          this.emit('stream', stream, data.payload.value)
        }
      }
    }
  }

  private removeStreamForKey(key: string) {
    delete this.streams[key]
    return this
  }

  private createOrGetStreamForKey(key: string, isSender: boolean, extraData?: T) {
    if (!this.streams[key]) {
      this.streams[key] = new WSStream<T>(this.wssend, key, isSender, extraData)
      const cleanUp = finished(this.streams[key], {error: false}, () => {
        this.removeStreamForKey(key)
        cleanUp()
      })
    }
    return this.streams[key]
  }

  public createStream(extraData?: T) {
    return this.createOrGetStreamForKey(generateId(), true, extraData)
  }

}
