import { describe, it, expect, afterEach } from 'vitest';
import { GoogleFinanceSource } from '../../src/b3/googlefinance.ts';
import { startServer } from './helpers.ts';
import type { ServerResponse } from 'node:http';
import pino from 'pino';

const nop = pino({ level: 'silent' });

function htmlResponse(res: ServerResponse, html: string): void {
  const buf = Buffer.from(html, 'utf-8');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': buf.length });
  res.end(buf);
}

describe('GoogleFinanceSource', () => {
  let close: (() => Promise<void>) | null = null;

  afterEach(async () => {
    await close?.();
    close = null;
  });

  it('parses current Google Finance beta quote markup', async () => {
    const html = `
      <div data-p="%.@.[null,[&quot;MXRF11&quot;,&quot;BVMF&quot;]]">
        <div class="gO24Ff">Maxi Renda Fundo Invest Imobiliario FII</div>
        <span jsname="Pdsbrc" class=""><span>R$ 9,92</span></span>
        <span jsname="vY9t3b" class=""><span class="gMvHvf">0,00%</span></span>
      </div>
    `;
    const srv = await startServer((_req, res) => htmlResponse(res, html));
    close = srv.close;

    const src = new GoogleFinanceSource(nop, srv.url);
    const q = await src.quote('MXRF11');

    expect(q.ticker).toBe('MXRF11');
    expect(q.name).toBe('Maxi Renda Fundo Invest Imobiliario FII');
    expect(q.price).toBe(9.92);
    expect(q.changePct).toBe(0);
    expect(q.source).toBe('googlefinance');
  });
});
