// CommonJS webpack config: the plugin ships a CJS build via the exports map.
const path = require('node:path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { FormGuardPlugin } = require('form-honeypot-guard/webpack');

module.exports = {
  mode: 'production',
  context: __dirname,
  entry: './src/main.js',
  output: { path: path.join(__dirname, 'dist'), clean: true, publicPath: '/' },
  plugins: [
    new HtmlWebpackPlugin({ template: './src/index.html' }),
    new FormGuardPlugin({
      forms: 'form[data-guard]',
      minTime: 3000,
      manifestPath: 'server/form-guard.manifest.json', // the Express server reads this
      verbose: true,
    }),
  ],
};
