# SCMP (Snet Cloud Monitoring Portal)

## Intro.
**SCMP** is **another branch** of an open-source web application derived from Influxdata's **_Chronograf_** written in Go and React.js that provides the tools to visualize your monitoring data and easily create alerting and automation rules.

Therefore, SCMP will be enhanced by adding our direction, such as automation of configuration management and monitoring over Clouds.

SCMP has been started with _Chronograf_ version **1.7.11**.

For more information of the basic common features between _Chronograf_ 1.7.11 and SCMP, dependencies and using guides like the way of TICK Script or Flux queries, refer to the following link.

[Github for _chronograf_](https://github.com/influxdata/chronograf/blob/master/README.md)

[Documents for TICK Stack](https://docs.influxdata.com/)

## Key Differences against _Chronograf_.
* Compose of directories.
  * Divide as backend and frontend.
* More easy debugging environment support without proxy server by node.js.
* For more Dev. Env., provide **Visual Studio Code** Env. including the setting.json and launch.json.
* Window build & run Env. support.

## Setting in VSCode
* Add the followings into **_setting.json_** to **User Setting** namespace.
```
{
  "terminal.integrated.shell.windows": "C:\\Program Files\\Git\\bin\\bash.exe",
  "terminal.integrated.rightClickBehavior": "default",
  "terminal.explorerKind": "external",
  "terminal.integrated.copyOnSelection": true,
  "terminal.integrated.scrollback": 10000,
  "breadcrumbs.enabled": true,
  "editor.renderControlCharacters": true,
  "editor.largeFileOptimizations": false,
  "editor.formatOnSave": true,
  "editor.renderWhitespace": "none",
  "workbench.startupEditor": "newUntitledFile",
  "explorer.confirmDelete": false,
  "explorer.confirmDragAndDrop": false,
  "files.eol": "\n",
  "go.formatTool": "goimports",
  "go.lintOnSave": "package",
  "prettier.singleQuote": true,
  "prettier.bracketSpacing": false,
  "prettier.semi": false,
  "prettier.trailingComma": "es5",
  "eslint.alwaysShowStatus": true,
  "tslint.jsEnable": true,
  "[jsonc]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "debug.showInStatusBar": "always",
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "debug.toolBarLocation": "docked",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```
## How to build
To do

## How to debug via VSCode
To do