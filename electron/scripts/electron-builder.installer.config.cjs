const path = require("path");

function pad(num) {
  return String(num).padStart(2, "0");
}

function buildDateTag(input = new Date()) {
  const yy = String(input.getFullYear()).slice(-2);
  return `${yy}${pad(input.getMonth() + 1)}${pad(input.getDate())}`;
}

const electronRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(electronRoot, "..");
const workspaceRoot = path.resolve(repoRoot, "..");
const electronPackageJson = require(path.join(electronRoot, "package.json"));
const releaseVersion = String(electronPackageJson.version || "0.0.0").trim() || "0.0.0";
const releaseDateTag = buildDateTag();

module.exports = {
  appId: "com.xiaodi.prompthelper",
  productName: "小迪助词器",
  asar: false,
  directories: {
    output: path.join(workspaceRoot, "临时缓存", "01-打包中间态", "electron-builder-installer", `v${releaseVersion}-${releaseDateTag}`),
    buildResources: path.join(electronRoot, "assets"),
  },
  files: [
    "main.js",
    "preload.js",
    "shell-ipc-contract.js",
    "package.json",
    "renderer/**/*",
    "server/**/*",
    "webui/**/*",
    "!server/data{,/**/*}",
    "!server/package-lock.json",
  ],
  artifactName: `小迪助词器安装包-v${releaseVersion}-${releaseDateTag}.\${ext}`,
  win: {
    icon: path.join(electronRoot, "assets", "app-icon.ico"),
    target: [
      {
        target: "nsis",
        arch: ["x64"],
      },
    ],
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: "小迪助词器",
    uninstallDisplayName: "小迪助词器",
  },
  publish: null,
};
