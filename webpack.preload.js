const path = require('path');

module.exports = {
  entry: './src/main/preload.ts',
  target: 'electron-preload',
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: 'preload.js',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: { configFile: 'tsconfig.main.json' },
        },
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    electron: 'commonjs electron',
  },
};
