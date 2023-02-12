const webpack = require('webpack')
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')

module.exports = {
	mode: 'production',
	entry: {
		bundle: path.resolve(__dirname, 'src/index.tsx'),
		webworker: path.resolve(
			__dirname,
			'src/shared/WebApi/web-workers/canvas-worker.ts'
		)
	},
	output: {
		path: path.resolve(__dirname, 'dist'),
		publicPath: 'auto',
		filename: '[name].[contenthash].js',
		clean: true,
		assetModuleFilename: '[name][ext]'
	},
	cache: {
		type: 'memory'
	},
	devServer: {
		static: [
			{
				directory: path.resolve(__dirname, 'dist')
			},
			{
				directory: path.resolve(__dirname, 'public')
			}
		],
		port: process.env.PORT || 3000,
		hot: true,
		compress: true,
		historyApiFallback: true
	},
	module: {
		rules: [
			{
				test: /\.(js|jsx|ts|tsx)$/,
				exclude: /node_modules/,
				use: ['babel-loader']
			},
			{
				test: /\.(png|jpg|jpeg|gif|ico)$/,
				exclude: /node_modules/,
				use: ['file-loader?name=[name].[ext]']
			},
			{
				test: /\.svg$/i,
				issuer: /\.[jt]sx?$/,
				use: ['@svgr/webpack']
			},
			{
				test: /\.css$/i,
				use: ['style-loader', 'css-loader']
			},
			{
				test: /\.(glsl|vs|fs|vert|frag)$/,
				exclude: /node_modules/,
				use: [
					'raw-loader', 'glslify-loader'
				]
			}
		]
	},
	plugins: [
		new HtmlWebpackPlugin({
			inject: true,
			title: 'Bindfly Gallery',
			template: './public/index.html',
			favicon: './public/favicon.ico',
			manifest: './public/manifest.json'
		}),
		new CleanWebpackPlugin(),
		new MiniCssExtractPlugin({
			filename: '[name].[contenthash].css'
		}),
		new webpack.ProvidePlugin({
			process: 'process/browser'
		})
	],
	resolve: {
		extensions: ['*', '.js', '.jsx', '.ts', '.tsx']
	},
	optimization: {
		splitChunks: {
			chunks: 'all'
		},
		minimize: true,
		minimizer: [
			new TerserPlugin({
				parallel: true,
				terserOptions: {
					keep_classnames: true,
					keep_fnames: true
				}
			})
		]
	},
	performance: {
		hints: false,
		maxEntrypointSize: 512000,
		maxAssetSize: 512000
	}
}
