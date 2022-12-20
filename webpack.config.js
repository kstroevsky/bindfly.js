const webpack = require('webpack');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
	mode: 'production',
	entry: {
		bundle: path.resolve(__dirname, 'src/index.tsx')
	},
	output: {
		path: path.resolve(__dirname, 'dist'),
		publicPath: 'auto',
		filename: '[name].[contenthash].js',
		clean: true,
		assetModuleFilename: '[name][ext]'
	},
	devtool: 'source-map',
	devServer: {
		static: [
			{
				directory: path.resolve(__dirname, 'dist')
			},
			{
				directory: path.resolve(__dirname, 'public')
			}
		],
		port: 3000,
		open: true,
		hot: true,
		compress: true,
		historyApiFallback: true
	},
	module: {
		rules: [
			{
				test: /\.(js|jsx)$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: ['@babel/preset-env']
					}
				}
			},
			{
				test: /\.(ts|tsx)?$/,
				use: 'ts-loader',
				exclude: /node_modules/
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
				test: /\.Worker.ts$/,
				loader: 'babel-loader',
				options: {
					instance: 'web-worker',
					configFileName: './src/shared/WebApi/web-workers/tsconfig.json'
				}
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
	performance: {
		hints: false,
		maxEntrypointSize: 512000,
		maxAssetSize: 512000
	}
};
