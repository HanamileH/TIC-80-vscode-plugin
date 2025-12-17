import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';
import { promisify } from 'util';

const exec = promisify(child_process.exec);

/**
 * TIC-80 Runner - handles launching TIC-80 with cartridges
 */
export class TIC80Runner {
    
    private context: vscode.ExtensionContext;
    
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }
    
    /**
     * Find TIC-80 executable automatically
     */
    async findTIC80Executable(): Promise<string | null> {
        const config = vscode.workspace.getConfiguration('tic80');
        const configuredPath = config.get<string>('executablePath');
        
        // Use configured path if set
        if (configuredPath && configuredPath.trim() !== '') {
            if (await this.validateExecutable(configuredPath)) {
                return configuredPath;
            } else {
                vscode.window.showWarningMessage(
                    `Configured TIC-80 path is invalid: ${configuredPath}`
                );
            }
        }
        
        // Common installation paths
        const possiblePaths = this.getPossibleTIC80Paths();
        
        for (const exePath of possiblePaths) {
            if (await this.validateExecutable(exePath)) {
                // Save found path to configuration
                await config.update('executablePath', exePath, vscode.ConfigurationTarget.Global);
                return exePath;
            }
        }
        
        return null;
    }
    
    /**
     * Get possible TIC-80 installation paths based on OS
     */
    private getPossibleTIC80Paths(): string[] {
        const paths: string[] = [];
        const platform = process.platform;
        
        if (platform === 'win32') {
            // Windows paths
            const home = process.env.USERPROFILE || process.env.HOME || '';
            paths.push(
                'C:\\Program Files\\TIC-80\\tic80.exe',
                'C:\\Program Files (x86)\\TIC-80\\tic80.exe',
                path.join(home, 'AppData\\Local\\Programs\\TIC-80\\tic80.exe'),
                path.join(home, 'Downloads\\tic80.exe'),
                'tic80.exe' // Try from PATH
            );
        } else if (platform === 'darwin') {
            // macOS paths
            const home = process.env.HOME || '';
            paths.push(
                '/Applications/TIC-80.app/Contents/MacOS/tic80',
                path.join(home, 'Applications/TIC-80.app/Contents/MacOS/tic80'),
                '/usr/local/bin/tic80',
                '/opt/homebrew/bin/tic80',
                'tic80' // Try from PATH
            );
        } else {
            // Linux and other Unix-like
            paths.push(
                '/usr/local/bin/tic80',
                '/usr/bin/tic80',
                '/snap/bin/tic80',
                path.join(process.env.HOME || '', '.local/bin/tic80'),
                'tic80' // Try from PATH
            );
        }
        
        return paths;
    }
    
    /**
     * Validate that executable exists and is runnable
     */
    private async validateExecutable(exePath: string): Promise<boolean> {
        try {
            // Check if file exists
            await fs.promises.access(exePath, fs.constants.F_OK);
            
            // Try to run with --help to verify it's TIC-80
            if (exePath.includes(' ')) {
                // Handle paths with spaces
                const quotedPath = `"${exePath}"`;
                const { stdout } = await exec(`${quotedPath} --help`, { timeout: 5000 });
                return stdout.includes('TIC-80') || stdout.includes('tic80');
            } else {
                const { stdout } = await exec(`${exePath} --help`, { timeout: 5000 });
                return stdout.includes('TIC-80') || stdout.includes('tic80');
            }
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Run cartridge in TIC-80
     * @param cartridgePath Full path to .lua cartridge file
     * @param projectRoot Root path of the project
     */
    async runCartridge(cartridgePath: string, projectRoot: string): Promise<boolean> {
        try {
            // Find TIC-80 executable
            const tic80Path = await this.findTIC80Executable();
            
            if (!tic80Path) {
                const choice = await vscode.window.showErrorMessage(
                    'TIC-80 executable not found. Please install TIC-80 or configure the path manually.',
                    'Open Settings',
                    'Open TIC-80 Website',
                    'Cancel'
                );
                
                if (choice === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'tic80.executablePath');
                } else if (choice === 'Open TIC-80 Website') {
                    vscode.env.openExternal(vscode.Uri.parse('https://tic80.com/'));
                }
                
                return false;
            }
            
            // Get cartridge filename
            const cartridgeName = path.basename(cartridgePath);
            
            // Get run arguments from configuration
            const config = vscode.workspace.getConfiguration('tic80');
            let argsTemplate = config.get<string>('runArguments') || 
                '--skip --fs ${workspaceFolder}/dist/ --cmd "load ${cartridge} & run"';
            
            // Replace variables in arguments template
            const args = argsTemplate
                .replace(/\${workspaceFolder}/g, projectRoot.replace(/\\/g, '/'))
                .replace(/\${cartridge}/g, cartridgeName);
            
            // Construct full command
            let command: string;
            if (tic80Path.includes(' ')) {
                command = `"${tic80Path}" ${args}`;
            } else {
                command = `${tic80Path} ${args}`;
            }
            
            console.log(`Running TIC-80: ${command}`);
            
            // Show progress notification
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Running TIC-80",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "TIC-80 is executed..." });
                
                try {
                    // Run TIC-80
                    const { stdout, stderr } = await exec(command, {
                        cwd: path.dirname(tic80Path)
                    });
                    
                    if (stderr && stderr.trim()) {
                        console.warn('TIC-80 stderr:', stderr);
                    }
                    
                    if (stdout && stdout.trim()) {
                        console.log('TIC-80 stdout:', stdout);
                    }
                    
                    progress.report({ message: "TIC-80 launched successfully!" });
                    return true;
                    
                } catch (error: any) {
                    console.error('Failed to run TIC-80:', error);
                    
                    if (error.code === 'ETIMEDOUT') {
                        // TIC-80 launched but didn't exit (normal for game)
                        progress.report({ message: "TIC-80 game is running..." });
                        return true;
                    } else if (error.stderr && error.stderr.includes('not found')) {
                        vscode.window.showErrorMessage(
                            `TIC-80 executable not found at: ${tic80Path}`
                        );
                        return false;
                    } else {
                        vscode.window.showErrorMessage(
                            `Failed to run TIC-80: ${error.message}`
                        );
                        return false;
                    }
                }
            });
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error running TIC-80: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Build and run cartridge in one step
     * @param projectPath Project root path
     * @param cartridgePath Optional cartridge path (if not provided, will find latest)
     */
    async buildAndRun(projectPath: string, cartridgePath?: string): Promise<boolean> {
        try {
            const config = vscode.workspace.getConfiguration('tic80');
            const autoBuild = config.get<boolean>('autoBuildBeforeRun', true);
            
            let finalCartridgePath = cartridgePath;
            
            // Auto-build if enabled
            if (autoBuild && !cartridgePath) {
                // Try to find latest cartridge in dist folder
                const distPath = path.join(projectPath, 'dist');
                if (fs.existsSync(distPath)) {
                    const files = await fs.promises.readdir(distPath);
                    const luaFiles = files
                        .filter(f => f.endsWith('.lua'))
                        .map(f => path.join(distPath, f))
                        .sort((a, b) => {
                            // Sort by modification time (newest first)
                            return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
                        });
                    
                    if (luaFiles.length > 0) {
                        finalCartridgePath = luaFiles[0];
                    }
                }
                
                if (!finalCartridgePath) {
                    const buildChoice = await vscode.window.showWarningMessage(
                        'No cartridge found. Build project first?',
                        'Build and Run',
                        'Cancel'
                    );
                    
                    if (buildChoice === 'Build and Run') {
                        // We'll need to trigger build from caller
                        return false; // Signal caller to build first
                    } else {
                        return false;
                    }
                }
            }
            
            if (!finalCartridgePath) {
                vscode.window.showErrorMessage('No cartridge specified for running');
                return false;
            }
            
            // Run the cartridge
            return await this.runCartridge(finalCartridgePath, projectPath);
            
        } catch (error: any) {
            vscode.window.showErrorMessage(`Build and run failed: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Open TIC-80 configuration in settings
     */
    openConfiguration(): void {
        vscode.commands.executeCommand('workbench.action.openSettings', 'tic80');
    }
    
    /**
     * Test TIC-80 installation
     */
    async testInstallation(): Promise<{ success: boolean; path: string | null; version?: string }> {
        try {
            const tic80Path = await this.findTIC80Executable();
            
            if (!tic80Path) {
                return { success: false, path: null };
            }
            
            // Try to get version
            try {
                let command = tic80Path;
                if (tic80Path.includes(' ')) {
                    command = `"${tic80Path}"`;
                }
                
                const { stdout } = await exec(`${command} --version`, { timeout: 3000 });
                const versionMatch = stdout.match(/TIC-80\s+(v?\d+\.\d+\.\d+)/i);
                
                return {
                    success: true,
                    path: tic80Path,
                    version: versionMatch ? versionMatch[1] : 'Unknown'
                };
            } catch {
                return { success: true, path: tic80Path, version: 'Unknown' };
            }
            
        } catch (error) {
            return { success: false, path: null };
        }
    }
}