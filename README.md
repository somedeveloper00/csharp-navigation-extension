# C# Extended Navigation

Rider-inspired structural navigation for C# in Visual Studio Code. It uses the active C# language server's document-symbol and reference providers, so it works with both C# Dev Kit and OmniSharp without parsing C# itself.

## Features

- Move to the **next or previous context** (type, method, property, field, or variable).
- Move specifically between **methods**, **types**, or **variables**.
- Jump outward to the **containing context**.
- Search a hierarchical list of contexts in the current file.
- Cycle through **usages** of the symbol under the caret, including usages in other files.
- Return to the **last edited location** in the current VS Code session.
- Use a dedicated navigation back/forward history.
- Choose whether navigation wraps and where targets are revealed.

All commands are available from the Command Palette under **C# Navigation**.

## Default shortcuts

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Next / previous context | Not assigned | Not assigned |
| Next / previous method | `Ctrl+Alt+Down` / `Ctrl+Alt+Up` | `Cmd+Alt+Down` / `Cmd+Alt+Up` |
| Context picker | `Ctrl+Shift+Alt+N` | `Cmd+Shift+Alt+N` |
| Next usage | `Ctrl+Alt+F7` | `Cmd+Alt+F7` |

Commands marked **Not assigned**, along with the remaining commands, intentionally have no default binding so they do not override common VS Code bindings. In particular, VS Code uses `Alt+Up` and `Alt+Down` to move lines on Windows, Linux, and macOS. Assign the context-navigation commands with **Preferences: Open Keyboard Shortcuts** if you want to opt in.

## Requirements

Install and enable a C# language extension that implements document symbols and references, such as Microsoft's C# extension/C# Dev Kit or OmniSharp. Results become available after that language server has finished loading the solution.

## Installation

### From the VS Code Marketplace

Once published, install **C# Extended Navigation** from the [VS Code Marketplace](https://marketplace.visualstudio.com/VSCode) or run **Extensions: Install Extensions** in VS Code, search for `C# Extended Navigation`, and select **Install**. Reload VS Code if prompted.

### From a VSIX file

To install a release before it is available on the Marketplace:

1. Download the `.vsix` file from the project's [GitHub releases](https://github.com/somedeveloper00/csharp-navigation-extension/releases).
2. In VS Code, open the Extensions view, select the **…** menu, then choose **Install from VSIX…**.
3. Select the downloaded file and reload VS Code when prompted.

Alternatively, install it from a terminal:

```sh
code --install-extension csharp-extended-navigation-<version>.vsix
```

After installation, open a C# workspace and wait for C# Dev Kit or OmniSharp to finish loading. Use the Command Palette and search for **C# Navigation** to run a command.

## Settings

- `csharpExtendedNavigation.wrapAround`: continue at the other end of a file (default: `true`).
- `csharpExtendedNavigation.includeLocalVariables`: include locals during variable/context navigation (default: `true`).
- `csharpExtendedNavigation.revealPosition`: reveal a target at the `center`, `top`, or editor `default` position.

## Development

```sh
npm install
npm run check
npm run compile
```

Press **F5** in VS Code to run an Extension Development Host after installing dependencies.
