const { spawn } = require("child_process");

const electronBinary = require("electron");
const cwd = process.cwd();
const env = { ...process.env };

delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, ["."], {
  cwd,
  env,
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (typeof code === "number") {
    process.exit(code);
    return;
  }
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(1);
});

