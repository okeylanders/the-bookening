const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = [
  {
    name: 'extension',
    entry: './src/extension.ts',
    target: 'node',
    externals: {
      vscode: 'commonjs vscode'
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.js']
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2'
    },
    plugins: [
    ], 
    devtool: 'source-map'
  },
  {
    name: 'webview',
    entry: './src/webview/index.tsx',
    target: 'web',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader']
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js']
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'webview.js'
    }, 
    devtool: 'source-map'
  }
];
