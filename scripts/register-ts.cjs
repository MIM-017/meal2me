// Minimal TypeScript CommonJS loader for the seed CLI, using the project's
// existing TypeScript dependency instead of adding a second runtime.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = process.cwd();
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function (request, parent, isMain, options) {
  let candidate = request.startsWith("@/") ? path.join(root, request.slice(2))
    : request.startsWith(".") && parent ? path.resolve(path.dirname(parent.filename), request) : null;
  if (candidate && !path.extname(candidate)) {
    for (const suffix of [".ts", ".tsx", ".js", ".json", path.join("", "index.ts")]) {
      const full = candidate + suffix;
      if (fs.existsSync(full)) return originalResolve.call(this, full, parent, isMain, options);
    }
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};
