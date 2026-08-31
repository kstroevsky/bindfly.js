const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')

module.exports = (_environment, argv) => ({
	mode: argv.mode || 'production',
	entry: path.resolve(__dirname, 'apps/studio/src/main.ts'),
	output: {
		path: path.resolve(__dirname, 'dist-v2'),
		filename: 'studio.[contenthash].js',
		publicPath: 'auto',
		clean: true,
	},
	devtool: argv.mode === 'development' ? 'source-map' : false,
	devServer: {
		static: {
			directory: path.resolve(__dirname, 'dist-v2'),
		},
		port: 3001,
		hot: true,
		compress: true,
		historyApiFallback: true,
	},
	module: {
		rules: [
			{
				test: /\.(ts|tsx)$/,
				exclude: /node_modules/,
				use: ['babel-loader'],
			},
			{
				test: /\.css$/i,
				use: ['style-loader', 'css-loader'],
			},
		],
	},
	plugins: [
		new CleanWebpackPlugin(),
		new HtmlWebpackPlugin({
			title: 'Bindfly 2 Studio',
			template: path.resolve(__dirname, 'apps/studio/public/index.html'),
		}),
	],
	resolve: {
		extensions: ['.ts', '.tsx', '.js'],
	},
	performance: {
		hints: false,
	},
})
