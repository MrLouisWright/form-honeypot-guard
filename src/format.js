// Terminal output in the header-sentinel style: coloured, NO_COLOR aware, ✖ error / ⚠ warn, [rule-id], indented fix line.
const useColor = (stream) => !('NO_COLOR' in process.env) && (process.env.FORCE_COLOR || stream?.isTTY);

export function pretty(results, { color = useColor(process.stdout), label = 'file' } = {}) {
  const c = (code) => (s) => (color ? `\x1b[${code}m${s}\x1b[0m` : String(s));
  const red = c(31), yellow = c(33), green = c(32), dim = c(2), bold = c(1), cyan = c(36);
  const lines = [];
  for (const r of results) {
    lines.push('', bold(r.file) + dim(` (${r.forms} form${r.forms === 1 ? '' : 's'})`));
    if (!r.findings.length) lines.push(green('  ✔ all checks passed'));
    for (const f of r.findings) {
      const tag = f.severity === 'error' ? red('✖ error') : yellow('⚠ warn ');
      lines.push(`  ${tag} ${bold(f.title)} ${dim('[' + f.id + ']')}`, `          ${f.message}`);
      if (f.fix) lines.push(...f.fix.split('\n').map((l, i) => `          ${i ? '' : cyan('fix: ')}${dim(l)}`));
    }
  }
  const e = results.reduce((s, r) => s + r.findings.filter((f) => f.severity === 'error').length, 0);
  const w = results.reduce((s, r) => s + r.findings.filter((f) => f.severity === 'warn').length, 0);
  lines.push('', `${results.length} ${label}(s) scanned: ${e ? red(e + ' error(s)') : green('0 errors')}, ${w ? yellow(w + ' warning(s)') : '0 warnings'}`);
  return lines.join('\n');
}
