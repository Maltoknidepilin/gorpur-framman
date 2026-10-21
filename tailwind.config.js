// Read config dir
let korpConfigDir = "app"
try {
    korpConfigDir = require("./run_config.json").configDir
} catch {}

module.exports = {
    content: ["./app/**/*.{js,ts,html}", korpConfigDir + "/**/*.{js,ts,html,yml}"],
    theme: {
        extend: {
            animation: {
                "spin-slow": "spin 2s linear infinite",
            },
            colors: {
                gray: {
                    100: "#f5f5f5",
                    200: "#eeeeee",
                    300: "#e0e0e0",
                    400: "#bdbdbd",
                    500: "#9e9e9e",
                    600: "#757575",
                    700: "#616161",
                    800: "#424242",
                    900: "#212121",
                },
                orange: {
                    900: "#f2581a",
                },
                // Sage greens from the Miklamálgrunnurin and Máltøknidepilin logos.
                brand: {
                    50: "#f3f7f6",
                    100: "#e1ece9",
                    200: "#c6dbd6",
                    300: "#a7c7bf",
                    400: "#87b0a9",
                    500: "#6f8f89",
                    600: "#586d69",
                    700: "#435b56",
                    800: "#334741",
                    900: "#24332f",
                },
            },
        },
    },
}
