import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

export type Handler = (req: IncomingMessage, res: ServerResponse) => void;

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

export async function startServer(handler: Handler): Promise<TestServer> {
  const server = createServer(handler);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const url = `http://127.0.0.1:${addr.port}`;

  return {
    url,
    close: () => new Promise((resolve, reject) => server.close(err => (err ? reject(err) : resolve()))),
  };
}

export function jsonResponse(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

export function statusResponse(res: ServerResponse, status: number): void {
  res.writeHead(status);
  res.end();
}
