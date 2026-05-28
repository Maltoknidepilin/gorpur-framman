const { merge } = require("webpack-merge")
const common = require("./webpack.common.js")

const host = process.env.KORP_HOST || "localhost" // Change localhost to 0.0.0.0 just to be safe
const port = process.env.KORP_PORT || 9111
const allowedHosts = process.env.KORP_ALLOWED_HOSTS
    ? process.env.KORP_ALLOWED_HOSTS.split(",").map((v) => v.trim()).filter(Boolean)
    : "auto"

// Force HTTP for internal Webpack (Nginx handles the HTTPS)
// Ensure you do NOT have KORP_HTTPS=true in your .env file when running this way
const server = "http" 

module.exports = merge(common, {
    devServer: {
        host,
        port,
        server,
        allowedHosts,
        
        // --- ADD THIS SECTION ---
        client: {
            // This tells the browser: "Connect to the WebSocket using the 
            // same Protocol, Host, and Port as the browser URL"
            // (i.e., go through Nginx, don't try 9111 directly)
            webSocketURL: 'auto://0.0.0.0:0/ws',
        },
        // ------------------------
    },
    devtool: "inline-source-map",
    optimization: {
        runtimeChunk: "single",
    },
    mode: "development",
})