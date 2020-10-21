export const generateId = (n: number = 32) => [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join('')

export const decode = (v: string | Buffer, encoding?: BufferEncoding) => typeof v === 'string' ? Buffer.from(v, encoding) : v

export const errOrUndefined = (p: Promise<any>) => p.then(() => void(0)).catch((err: Error) => err || new Error())
