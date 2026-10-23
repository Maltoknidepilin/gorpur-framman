const { merge } = require("webpack-merge")
const common = require("./webpack.common.js")
const CompressionPlugin = require("compression-webpack-plugin")
const TerserPlugin = require("terser-webpack-plugin")
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer")

module.exports = merge(common, {
    plugins: [
        new CompressionPlugin({}),
        ...(process.env.ANALYZE_BUNDLE === "true"
            ? [
                  new BundleAnalyzerPlugin({
                      analyzerMode: "static",
                      openAnalyzer: false,
                  }),
              ]
            : []),
    ],
    optimization: {
        minimizer: [
            new TerserPlugin({
                terserOptions: {
                    mangle: {
                        reserved: ["$super"],
                    },
                },
            }),
        ],
    },
    mode: "production",
})
