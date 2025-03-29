import { defineConfig } from "tsup"

export default defineConfig({
	target: "esnext",
	format: ["cjs", "esm"],
	splitting: true,
	sourcemap: true,
	clean: true,
	dts: false,
	cjsInterop: true,
})
