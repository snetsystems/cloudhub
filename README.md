# SCMP (Snet Cloud Monitoring Portal) - Latest v0.0.7

## Intro.

**SCMP** is **another branch** of an open-source web application derived from Influxdata's **_Chronograf_** written in Go and React.js that provides the tools to visualize your monitoring data and easily create alerting and automation rules.

Therefore, SCMP will be enhanced by adding our direction, such as automation of configuration management and monitoring the systems or applications over several Clouds.

SCMP has been started with _Chronograf_ version **1.7.11**.

### Using the basic common features

As we follow on using guides like the way of _TICK_ Script or _Flux_ queries, for more informations of the basic common features between _Chronograf_ 1.7.11 and SCMP refer to the following link.<br>
[Github for **_chronograf_**](https://github.com/influxdata/chronograf/blob/master/README.md)<br>
[Documents for **_TICK Stack_**](https://docs.influxdata.com/)

### Test Environment

For running this project, maybe, you should get the environment for test data and composition like telegraf, kapacity and influxdb (but not need chronograf).
This **_Sandbox_** provided by _Influxdata_ will help to do.<br>
[Download **_Sandbox_**](https://github.com/influxdata/sandbox)

## Key Differences against _Chronograf_ at this point(version).

- Compose of directories.
  - Divide as backend and frontend.
- Easier debugging environment support without a proxy server by node.js.
- For more Dev. Env., provide **Visual Studio Code** Env. including the setting.json and launch.json.
- Window build & run Env. support.
- Hosts to Infrastructures and basic charts added.
- Visualization added by criteria of Applications.

## Setting in VSCode

- Add the followings into **_setting.json_** to **User Setting** namespace.

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

### Preparing dependencies

- SCMP works with go 1.11+, node LTS, and yarn 1.7+.
- In the case of Windows, it cannot be invoked "make" command,<br>So you need to download and install [GNUMake](http://gnuwin32.sourceforge.net/packages/make.htm) for windows.
  - [Direct download](http://gnuwin32.sourceforge.net/downlinks/make.php)

### Getting the source code from github.

[If you're on Windows, run "Git Bash" and] type the followings.

```
# If you're on Windows, run "Git Bash" and type the followings.

$ go get github.com/snetsystems/cmp
$ cd $GOPATH/src/github.com/snetsystems/cmp
$ make
```

If well done, you can see the binary.

```
$ cd backend/cmd/cmp
$ ls -l
total 28072
...
-rwxr-xr-x 1 Snetsystems 197121 28610048 Jul 15 09:09 scmp
```

Once run scmp, 8888 port will be listened.

```
$ ./scmp
```

You can see the SCMP UI via browser: http://localhost:8888

## How to debug via VSCode for Development.

For your convenience, make "_.code-workspace_" for VSCode in your snetsystems folder.

```
$ cd $GOPATH/src/github.com/snetsystems/
$ cat snet.code-workspace
{
  "folders": [
    {
      "path": "cmp"
    }
  ],
  "settings": {
    "files.exclude": {}
  }
}
```

Run VSCode as above workspace.

```
$ code snet.code-workspace
```

Simply, select **"Launch Server"** and then run.<br>
Also, for UI debugging, select **"Launch Chrome"** and then run debug.<br>
For continuous debugging, you can use **"Launch Chrome"** after _**yarn start**_<br>
> [Note]<br>
> For continuous debugging, you need to add **_develop mode_** into the running argument.

> We already prepared **"_.vscode/launch.json_"** and **"_.vscode/settings.json_"**
>
> > - Using **GO111MODULE**.
> >   - Not need a vendor directory anymore.
> > - Snetsystems Github login setting as a default.
> >   - You need to change to the Github's keys of your organization.
> >   - If you don't need to login, get rid of the login information.
> >   ```
> >    ...
> >    "args": [
> >      "-l=debug",
> >      "-d"
> >      "-c=./cmp-canned/",
> >      "--protoboards-path=./cmp-protoboards/",
> >      "--auth-duration=0",
> >      "-t=74c1e9e2450886060b5bf736b935cd0bf960837f",
> >      "--github-client-id=c170bbdba5cb2ea8c3e6",
> >      "--github-client-secret=55c35715b0e4eebab7edbdeef3081bf890e79d22"
> >    ],
> >    ...
> >   ```

If you run a not login mode, you can use **"Launch Chrome via Proxy"** after _**yarn start**_

````
$ cd $CMP_PATH/frontend
$ yarn start
yarn run v1.15.2
$ node parcel.jsx
Serving on http://localhost:8080
√  Built in 7.54s.
````
