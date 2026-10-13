import express from 'express';
import { fileURLToPath } from 'node:url';
import { expressGuard, cleanFields } from 'form-honeypot-guard';

const manifest = fileURLToPath(new URL('./form-guard.manifest.json', import.meta.url));
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(expressGuard({
  manifest,                              // field names + minTime from the webpack build
  paths: ['/contact'],
  rateLimit: { limit: Number(process.env.RATE_LIMIT || 5), windowMs: 60_000, keys: ['ip', 'email'] },
  silent: process.env.SILENT === '1',
  onBlock: (r, { ip }) => console.log(`blocked ${ip}: ${r.reasons.join(', ')}`),
}));
app.post('/contact', (req, res) => {
  console.log('accepted', cleanFields(req.body, { manifest }), 'score', req.formGuard.score);
  res.json({ ok: true });
});
app.use(express.static(fileURLToPath(new URL('../dist', import.meta.url))));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`http://localhost:${port}`));
