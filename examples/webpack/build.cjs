// node build.cjs  (same as `npx webpack --config webpack.config.cjs` when webpack-cli is installed)
const webpack = require('webpack');
webpack(require('./webpack.config.cjs'), (err, stats) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(stats.toString({ colors: true, modules: false, logging: 'info' }));
  process.exit(stats.hasErrors() ? 1 : 0);
});
