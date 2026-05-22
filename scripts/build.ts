import dts from "bun-plugin-dts"

const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  target: "bun",
  format: "esm",
  plugins: [dts()],
})

if (!result.success) {
  console.error("Build failed:", result.logs)
  process.exit(1)
}

console.log(`Built ${result.outputs.length} outputs`)
