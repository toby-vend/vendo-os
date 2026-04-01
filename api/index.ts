import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Dynamic import to avoid top-level side effects
  const { default: app } = await import('../web/server.js');
  await app.ready();

  const url = req.url || '/';
  const headers: Record<string, string> = {};
  for (const [key, val] of Object.entries(req.headers)) {
    if (typeof val === 'string') headers[key] = val;
    else if (Array.isArray(val)) headers[key] = val.join(', ');
  }

  // Read body for POST requests
  let payload: string | undefined;
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    payload = Buffer.concat(chunks).toString();
  }

  const response = await app.inject({
    method: req.method as any,
    url,
    headers,
    payload,
  });

  // Forward status, headers, body
  res.statusCode = response.statusCode;

  const responseHeaders = response.headers;
  for (const [key, val] of Object.entries(responseHeaders)) {
    if (val !== undefined) {
      res.setHeader(key, val as string);
    }
  }

  res.end(response.rawPayload);
}
