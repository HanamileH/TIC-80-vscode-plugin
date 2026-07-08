# TIC-80 Game Development Extension for Visual Studio Code

## Overview
A comprehensive extension for developing games for the TIC-80 fantasy console directly within Visual Studio Code. This extension provides a complete workflow for creating, building, and running TIC-80 cartridges with support for multiple file projects, resource management, and seamless integration with the TIC-80 emulator.

## ⚠️ Important Beta Warning

**This extension is currently in BETA version (v0.2.0).**

### Data Loss Warning
There is a risk of data loss due to potential bugs in the synchronization and file management features. The extension performs automated file operations that could potentially overwrite or modify your game files.

### Safety Recommendations
1. **ALWAYS use version control** (Git recommended) for your TIC-80 projects
2. **Regularly create backups** of your project folders
3. **Test the extension** with sample projects before using it for important work
4. **Monitor file changes** when using auto-sync features

## Features

### Project Management
- Create new TIC-80 projects with standardized structure
- Automatic project detection when opening folders
- Project configuration via `tic80_project.json` file
- Support for multiple Lua code files with automatic concatenation

### Build System
- Compile projects into TIC-80 .lua cartridges
- Combine multiple source files in specified order
- Add proper cartridge headers and metadata
- Support for all TIC-80 resource types (sprites, tiles, maps, sounds, etc.)
- Resource organization across 8 memory banks

### TIC-80 Integration
- Launch games directly in TIC-80 emulator
- Automatic TIC-80 executable detection
- Configurable run arguments and options
- Support for Windows, macOS, and Linux
- **Pro version** of TIC-80 is required

### Resource Management
- Resource file scanning and validation
- Automatic synchronization between cartridge and project files
- Two-way sync: project files ↔ TIC-80 editor
- Support for all resource types: TILES, SPRITES, MAP, WAVES, SFX, PATTERNS, TRACKS, SCREEN, PALETTE
- Bank-based resource organization (banks 0-7)

### Development Workflow
- Status bar integration showing project state
- Quick access to common commands via command palette
- Contextual menus for Lua files and project folders
- Keyboard shortcuts for build and run operations
- Real-time error validation and notifications

## Project Structure
```
my-game/
├── tic80_project.json     # Project configuration
├── src/
│   ├── main.lua         # Main game code
│   └── *.lua            # Additional Lua modules
├── assets/              # Cartridge resources (created automatically)
│   ├── tiles.tic_data   # Main bank resources
│   ├── sprites.tic_data
│   ├── bank_1/          # Additional resource banks (created when using other banks)
│   └── bank_2/
└── dist/
    └── game.lua         # Built cartridge
```

## Usage

### Getting Started
1. **Download and install** the extension from:
   - [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/manage/publishers/hanamileh/extensions/tic80-cartridge-tool/hub)
   - Or search "TIC-80 Cartridge tool" (By HanamileH) in VS Code Extensions view (Ctrl+Shift+X)
2. Open Command Palette (Ctrl+Shift+P)
3. Run `TIC-80: New Project (Current Folder)`
4. Enter project details (if no folder is open, you will be asked to pick one)
5. Start coding in the `src/` directory

### Syncing Resources
1. Run the built cartridge in the TIC-80 (using `Run project` command or manually)
2. Make changes to resources in the TIC-80 editor
3. Use the `Sync Resources` command to update your project files with the changes made in TIC-80
4. Click `Apply All` to confirm the change of all resources, or select the necessary resources manually

### Managing Multiple Lua Files
This extension supports working with multiple .lua files and performs their automatic concatenation during the build process.
At the moment, the files are combined directly, without using `require` statements. The order of concatenation is determined by the order of files in the project configuration file (`tic80_project.json`). You can specify the order of files in the `code_files` array in the configuration file. 
To add a new Lua file to the project, simply create it in the `src/` directory and add its name to the `code_files` array in the configuration file.
Please note that the order of combining files is important, and it can change the behavior of your code or cause an error during execution. For example, local variables cannot be used before they are declared.

### Basic Commands
- **New Project (Current Folder)**: Set up a new TIC-80 game project in the open folder
- **Build Project**: Compile project into .lua cartridge
- **Run Project**: Launch game in TIC-80 emulator
- **Build and Run**: Combine build and run in one step
- **Sync Resources**: Update project files from cartridge changes

### Configuration
The extension can be configured through VS Code settings:
- `tic80.executablePath`: Path to TIC-80 executable
- `tic80.runArguments`: Custom arguments for running TIC-80
- `tic80.autoSyncResources`: Enable/disable automatic resource sync
- `tic80.autoBuildBeforeRun`: Build automatically before running
- `tic80.author`: Default author name for new projects

## Requirements
- Visual Studio Code 1.85.0 or higher
- TIC-80 pro version (version 1.0 or higher recommended)

## Supported Platforms
- Windows (x64)
- macOS (Intel and Apple Silicon)
- Linux (x64, ARM)

## Contributing
This extension is open for contributions. Please report issues and feature requests on the GitHub repository.

## License
MIT License - see LICENSE file for details.

## Links
- TIC-80 Official Website: https://tic80.com/
- TIC-80 Documentation: https://github.com/nesbox/TIC-80/wiki

---

*This extension is not officially affiliated with TIC-80 or Nesbox. TIC-80 is a trademark of Nesbox.*
