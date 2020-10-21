export const generateId = (n: number = 32) => [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')

export const decode = (v: string | Buffer, encoding?: BufferEncoding) => typeof v === 'string' ? Buffer.from(v, encoding) : v
