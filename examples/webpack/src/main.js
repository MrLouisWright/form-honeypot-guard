// Optional: submit with fetch instead of a full page post.
import { fields } from 'form-guard/config';

const form = document.getElementById('contact');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = await window.FormGuard.formData(form); // honeypot + token + JS proof + signals included
  const res = await fetch(form.action, { method: 'POST', body: new URLSearchParams(body) });
  document.getElementById('status').textContent = res.ok ? 'Thanks!' : `Blocked (${res.status})`;
});
console.debug('form-guard honeypot field:', fields.honeypot);
