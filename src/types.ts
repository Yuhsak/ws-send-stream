export type WSStreamPayloadData<T> = {
  source: 'ws-send-stream'
  type: 'stream.data'
  key: string
  payload: any
}

export type WSStreamPayloadControl<T> = {
  source: 'ws-send-stream'
  type: 'stream.control'
  key: string
  payload: {
    type: 'create'
    value?: T
  } | {
    type: 'canPushNext'
    value: boolean
  } | {
    type: 'end'
  } | {
    type: 'destroy'
  }
}

export type WSStreamPayload<T> = WSStreamPayloadData<T> | WSStreamPayloadControl<T>

export type DOmit<T, K extends keyof T> = T extends infer U ? Omit<T, K> : never
