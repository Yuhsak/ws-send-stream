# ws-send-stream

Create stream over WebSocket by ws, written in TypeScript.

## Install

```sh
npm install ws-send-stream
```

## Usage

Both server and client can create stream just in same way.

Here is an example below for in case a stream will be created at the server side.

### Server

```ts
import http from 'http'
import WS from 'ws'
import {wssstream} from 'ws-send-stream'

const server = http.createServer()

const wsServer = new WS.Server({server})

server.listen(8000, () => {
  console.log('WebSocket Server listening on 8000')
})

wsServer.on('connection', socket => {

  const wss = wssstream(socket)

  const stream = wss.createStream({someData: 'some extra data'})

  stream.pipe(process.stdout)

  stream.on('finish', () => {
    console.log('Server stream has finished writing')
  })

  stream.on('end', () => {
    console.log('Server stream has finished reading')
    stream.end()
  })

  socket.on('close', () => {
    console.log('WebSocket closed')
    server.close()
  })

  stream.write('Echo from server\n')

})
```

### Client

```ts
import WS from 'ws'
import {wssstream} from 'ws-send-stream'

const socket = new WS('ws://localhost:8000')

socket.on('open', () => {

  const wss = wssstream(socket)

  wss.on('stream', (stream, extraData) => {

    // extraData => {someData: 'some extra data'}
    console.log(extraData)

    stream.pipe(process.stdout)

    stream.on('finish', () => {
      console.log('Client stream has finished writing')
    })

    stream.on('end', () => {
      console.log('Client stream has finished reading')
      socket.close()
    })

    stream.write('Echo from client\n')

    stream.end()

  })

})
```
