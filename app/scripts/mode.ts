import { getUrlParam } from "./urlparams"
import runConfig from "../../run_config.json"

if (!runConfig.defaultKorpMode) {
    console.warn(
        'Warning: "defaultKorpMode" is not set in run_config.json. Falling back to "default" mode.'
    )
}

// Priority: URL parameter > run_config.json > "default"
const currentMode = getUrlParam("mode") || runConfig.defaultKorpMode || "default"

export default currentMode
