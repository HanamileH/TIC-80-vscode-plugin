import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TIC80ProjectConfig, DEFAULT_PROJECT_CONFIG, DEFAULT_LUA_CODE } from './projectTypes';
import { CartridgeBuilder } from './cartridgeBuilder';
import { ResourceManager } from './resourceManager';
import { TIC80Runner } from './tic80Runner';
import { SyncService } from './syncService';

/**
 * Project Manager - handles project creation, loading and validation
 */
export class ProjectManager {
    
    private static readonly CONFIG_FILE = 'tic80_project.json';
    private currentProject: TIC80ProjectConfig | null = null;
    private projectRoot: string | null = null;
    private cartridgeBuilder: CartridgeBuilder;
    private resourceManager: ResourceManager;
    private tic80Runner: TIC80Runner;
    private syncService: SyncService;
    
    constructor(context: vscode.ExtensionContext) {
        this.cartridgeBuilder = new CartridgeBuilder();
        this.resourceManager = new ResourceManager();
        this.tic80Runner = new TIC80Runner(context);
        this.syncService = new SyncService();
    }

    /**
     * Check if current workspace is a TIC-80 project
     */
    async isTIC80Project(): Promise<boolean> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return false;
        }
        
        const rootPath = workspaceFolders[0].uri.fsPath;
        const configPath = path.join(rootPath, ProjectManager.CONFIG_FILE);
        
        return new Promise((resolve) => {
            fs.access(configPath, fs.constants.F_OK, (err) => {
                resolve(!err);
            });
        });
    }
    
    /**
     * Load project and start watching for changes
     */
    async loadProject(): Promise<TIC80ProjectConfig | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }
        
        this.projectRoot = workspaceFolders[0].uri.fsPath;
        const configPath = path.join(this.projectRoot, ProjectManager.CONFIG_FILE);
        
        try {
            const configData = await fs.promises.readFile(configPath, 'utf8');
            this.currentProject = JSON.parse(configData);
            
            // Start watching for cartridge changes
            await this.startWatchingForChanges();
            
            return this.currentProject;
        } catch (error) {
            console.error('Failed to load project:', error);
            return null;
        }
    }

    /**
     * Start watching for cartridge changes
     */
    private async startWatchingForChanges(): Promise<void> {
        if (!this.projectRoot) {
            return;
        }
        
        // Check if auto-sync is enabled
        const config = vscode.workspace.getConfiguration('tic80');
        const autoSync = config.get<boolean>('autoSyncResources', true);
        
        if (autoSync) {
            await this.syncService.startWatching(this.projectRoot);
        }
    }
    
    /**
     * Stop watching for changes
     */
    stopWatching(): void {
        this.syncService.stopWatching();
    }
    
    /**
     * Manually sync resources from cartridge
     */
    async syncResourcesFromCartridge(cartridgePath?: string): Promise<boolean> {
        if (!this.projectRoot) {
            vscode.window.showErrorMessage('No project loaded');
            return false;
        }
        
        // Find cartridge if not specified
        let finalCartridgePath = cartridgePath;
        if (!finalCartridgePath) {
            const distPath = path.join(this.projectRoot, 'dist');
            if (fs.existsSync(distPath)) {
                const files = await fs.promises.readdir(distPath);
                const luaFiles = files
                    .filter(f => f.endsWith('.lua'))
                    .map(f => path.join(distPath, f))
                    .sort((a, b) => {
                        return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
                    });
                
                if (luaFiles.length === 0) {
                    vscode.window.showErrorMessage('No cartridge found. Build project first.');
                    return false;
                }
                
                finalCartridgePath = luaFiles[0];
            } else {
                vscode.window.showErrorMessage('No dist folder found. Build project first.');
                return false;
            }
        }
        
        return await this.syncService.manualSync(finalCartridgePath, this.projectRoot);
    }

    /**
     * Toggle auto-sync feature
     */
    toggleAutoSync(): void {
        const status = this.syncService.getSyncStatus();
        const newState = !status.enabled;
        
        this.syncService.setSyncEnabled(newState);
        
        if (newState && this.projectRoot) {
            this.syncService.startWatching(this.projectRoot);
            vscode.window.showInformationMessage('Auto-sync enabled');
        } else {
            this.syncService.stopWatching();
            vscode.window.showInformationMessage('Auto-sync disabled');
        }
    }

    /**
     * Check if resources need syncing
     */
    async checkForResourceChanges(): Promise<void> {
        if (!this.projectRoot) {
            vscode.window.showErrorMessage('No project loaded');
            return;
        }
        
        // Find latest cartridge
        const distPath = path.join(this.projectRoot, 'dist');
        if (!fs.existsSync(distPath)) {
            vscode.window.showInformationMessage('No cartridge found. Build project first.');
            return;
        }
        
        const files = await fs.promises.readdir(distPath);
        const luaFiles = files
            .filter(f => f.endsWith('.lua'))
            .map(f => path.join(distPath, f))
            .sort((a, b) => {
                return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
            });
        
        if (luaFiles.length === 0) {
            vscode.window.showInformationMessage('No cartridge found. Build project first.');
            return;
        }
        
        const cartridgePath = luaFiles[0];
        const needsSync = await this.syncService.checkSyncNeeded(cartridgePath, this.projectRoot);
        
        if (needsSync) {
            const choice = await vscode.window.showInformationMessage(
                'Resource changes detected in cartridge. Sync now?',
                'Sync Now',
                'Ignore'
            );
            
            if (choice === 'Sync Now') {
                await this.syncResourcesFromCartridge(cartridgePath);
            }
        } else {
            vscode.window.showInformationMessage('No resource changes detected');
        }
    }
    
    /**
     * Get sync status
     */
    getSyncStatus(): { enabled: boolean; watching: boolean } {
        return this.syncService.getSyncStatus();
    }

    /**
     * Create resource templates for new project
     */
    private async createResourceTemplates(projectPath: string): Promise<void> {
        await this.resourceManager.createResourceTemplates(projectPath);
    }

    /**
     * Create a new TIC-80 project in the current workspace folder (if any).
     */
    async createNewProjectInWorkspace(): Promise<string | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No folder is open. Open a folder first, then run "TIC-80: New Project".');
            return null;
        }
        
        const projectPath = workspaceFolders[0].uri.fsPath;
        return await this.createProjectAtPath(projectPath, { openFolderAfterCreate: false, allowNonEmpty: true });
    }

    /**
     * Create a new TIC-80 project (asks for folder).
     */
    async createNewProject(): Promise<string | null> {
        const projectUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select folder for new project',
            title: 'Create TIC-80 Project'
        });
        
        if (!projectUri || projectUri.length === 0) {
            return null; // User cancelled
        }
        
        const projectPath = projectUri[0].fsPath;
        return await this.createProjectAtPath(projectPath, { openFolderAfterCreate: true, allowNonEmpty: true });
    }

    private async createProjectAtPath(
        projectPath: string,
        options: { openFolderAfterCreate: boolean; allowNonEmpty: boolean }
    ): Promise<string | null> {
        const configPath = path.join(projectPath, ProjectManager.CONFIG_FILE);
        if (fs.existsSync(configPath)) {
            vscode.window.showErrorMessage(`This folder already contains a TIC-80 project (${ProjectManager.CONFIG_FILE}).`);
            return null;
        }
        
        if (!options.allowNonEmpty) {
            const entries = await fs.promises.readdir(projectPath);
            if (entries.length > 0) {
                vscode.window.showErrorMessage('Selected folder is not empty.');
                return null;
            }
        } else {
            const entries = await fs.promises.readdir(projectPath);
            const wouldCreate = ['src', 'assets', 'dist', ProjectManager.CONFIG_FILE, path.join('src', 'main.lua')];
            const collisions = wouldCreate.filter(p => fs.existsSync(path.join(projectPath, p)));
            if (collisions.length > 0) {
                const choice = await vscode.window.showWarningMessage(
                    `Some files/folders already exist (${collisions.slice(0, 4).join(', ')}${collisions.length > 4 ? ', ...' : ''}). Create project without overwriting existing files?`,
                    { modal: true },
                    'Create'
                );
                if (choice !== 'Create') {
                    return null;
                }
            }
        }
        
        // Ask for project name
        const projectName = await vscode.window.showInputBox({
            prompt: 'Enter project name',
            placeHolder: 'My TIC-80 Game',
            value: path.basename(projectPath) || 'My TIC-80 Game',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Project name cannot be empty';
                }
                return null;
            }
        });
        
        if (!projectName) {
            return null; // User cancelled
        }
        
        try {
            const scriptSetting = vscode.workspace.getConfiguration('tic80').get<string>('defaultScriptLanguage', 'lua');
            let script: TIC80ProjectConfig['cart_metadata']['script'] = 'lua';
            if (scriptSetting === 'lua') {
                script = 'lua';
            } else {
                vscode.window.showWarningMessage('Only Lua projects are currently supported by the cartridge builder. Project will be created with Lua.');
            }

            // Update project configuration with user input
            const projectConfig: TIC80ProjectConfig = {
                ...DEFAULT_PROJECT_CONFIG,
                name: projectName,
                cart_metadata: {
                    ...DEFAULT_PROJECT_CONFIG.cart_metadata,
                    title: projectName,
                    author: await this.getAuthorName(),
                    script
                },
                code_files: ['src/main.lua']
            };
            
            // Create project structure
            await this.createProjectStructure(projectPath, projectConfig);
            
            // Create resource templates
            await this.createResourceTemplates(projectPath);
            
            // Save configuration
            await fs.promises.writeFile(
                configPath,
                JSON.stringify(projectConfig, null, 2),
                'utf8'
            );
            
            // Create main.lua file
            const mainLuaPath = path.join(projectPath, 'src', 'main.lua');
            if (!fs.existsSync(mainLuaPath)) {
                await fs.promises.writeFile(mainLuaPath, DEFAULT_LUA_CODE, 'utf8');
            }
            
            // Create .gitignore
            const gitignorePath = path.join(projectPath, '.gitignore');
            if (!fs.existsSync(gitignorePath)) {
                await fs.promises.writeFile(gitignorePath, 'dist/\n*.tic\n', 'utf8');
            }
            
            // Create empty asset files
            await this.createEmptyAssets(projectPath);
            
            // Set as current project
            this.projectRoot = projectPath;
            this.currentProject = projectConfig;
            
            vscode.window.showInformationMessage(`Project "${projectName}" created successfully!`);
            
            // Open the project in new window if requested
            if (options.openFolderAfterCreate) {
                vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath));
            } else {
                // Open main file in current window
                try {
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(mainLuaPath));
                    await vscode.window.showTextDocument(doc, { preview: false });
                } catch {
                    // ignore
                }
            }
            
            return projectPath;
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create project: ${error}`);
            return null;
        }
    }
        /**
     * Scan and get all resources in current project
     */
    async getProjectResources(): Promise<Record<string, any>> {
        if (!this.projectRoot) {
            return {};
        }
        
        const resources = await this.resourceManager.scanResources(this.projectRoot);
        return resources;
    }
    
    /**
     * Validate project resources
     */
    async validateProjectResources(): Promise<{ valid: boolean; errors: string[] }> {
        if (!this.projectRoot) {
            return { valid: false, errors: ['Project not loaded'] };
        }
        
        return await this.resourceManager.validateResources(this.projectRoot);
    }
    
    /**
     * Create project directory structure
     */
    private async createProjectStructure(projectPath: string, config: TIC80ProjectConfig): Promise<void> {
        const directories = [
            'src',
            'assets',
            'dist'
        ];
        
        // Create directories
        for (const dir of directories) {
            const dirPath = path.join(projectPath, dir);
            await fs.promises.mkdir(dirPath, { recursive: true });
        }
    }
    
    /**
     * Create empty asset files
     */
    private async createEmptyAssets(projectPath: string): Promise<void> {
        // For now, just create a text file explaining what should be here
        const spritesInfoPath = path.join(projectPath, 'assets', 'sprites.txt');
        if (!fs.existsSync(spritesInfoPath)) {
            await fs.promises.writeFile(
                spritesInfoPath,
                'Place your sprites here (128x128 pixels, indexed colors)\n',
                'utf8'
            );
        }
    }
    
    /**
     * Get author name from VS Code settings or ask user
     */
    private async getAuthorName(): Promise<string> {
        // Try to get from VS Code settings
        const config = vscode.workspace.getConfiguration('tic80');
        const author = config.get<string>('author');
        
        if (author) {
            return author;
        }
        
        // Ask user
        const input = await vscode.window.showInputBox({
            prompt: 'Enter your name (will be saved as author)',
            placeHolder: 'Your Name',
            value: vscode.workspace.name || 'Unknown'
        });
        
        return input || 'Unknown';
    }
    
    /**
     * Get current project configuration
     */
    getCurrentProject(): TIC80ProjectConfig | null {
        return this.currentProject;
    }
    
    /**
     * Get project root path
     */
    getProjectRoot(): string | null {
        return this.projectRoot;
    }
    
    /**
     * Save project configuration
     */
    async saveProjectConfig(config: TIC80ProjectConfig): Promise<boolean> {
        if (!this.projectRoot) {
            return false;
        }
        
        try {
            const configPath = path.join(this.projectRoot, ProjectManager.CONFIG_FILE);
            await fs.promises.writeFile(
                configPath,
                JSON.stringify(config, null, 2),
                'utf8'
            );
            
            this.currentProject = config;
            return true;
        } catch (error) {
            console.error('Failed to save project config:', error);
            return false;
        }
    }
    
    /**
     * Run current project in TIC-80
     */
    async runCurrentProject(cartridgePath?: string): Promise<boolean> {
        if (!this.projectRoot) {
            vscode.window.showErrorMessage('No project loaded. Please open a TIC-80 project first.');
            return false;
        }
        
        const projectRoot = this.projectRoot;
        
        // If no cartridge path provided, find latest
        let finalCartridgePath = cartridgePath;
        if (!finalCartridgePath) {
            const distPath = path.join(projectRoot, 'dist');
            if (fs.existsSync(distPath)) {
                const files = await fs.promises.readdir(distPath);
                const luaFiles = files
                    .filter(f => f.endsWith('.lua'))
                    .map(f => path.join(distPath, f))
                    .sort((a, b) => {
                        return fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime();
                    });
                
                if (luaFiles.length > 0) {
                    finalCartridgePath = luaFiles[0];
                }
            }
        }
        
        if (!finalCartridgePath) {
            const choice = await vscode.window.showWarningMessage(
                'No cartridge found. Build project first?',
                'Build and Run',
                'Cancel'
            );
            
            if (choice === 'Build and Run') {
                // Build first, then run
                const builtPath = await this.buildCurrentProject();
                if (builtPath) {
                    return await this.tic80Runner.runCartridge(builtPath, projectRoot);
                }
                return false;
            }
            
            return false;
        }
        
        // Run the cartridge
        return await this.tic80Runner.runCartridge(finalCartridgePath, projectRoot);
    }

    /**
     * Build the current project into a cartridge
     */
    async buildCurrentProject(): Promise<string | null> {
        if (!this.currentProject || !this.projectRoot) {
            vscode.window.showErrorMessage('No project loaded. Please open a TIC-80 project first.');
            return null;
        }
        
        // Type assertion: projectRoot and currentProject are guaranteed to be set if we reach this point
        const projectRoot = this.projectRoot as string;
        const currentProject = this.currentProject as TIC80ProjectConfig;
        
        // Show progress notification
        const progressOptions = {
            location: vscode.ProgressLocation.Notification,
            title: "Building TIC-80 Cartridge",
            cancellable: false
        };
        
        return await vscode.window.withProgress(progressOptions, async (progress) => {
            try {
                progress.report({ message: "Validating project configuration..." });
                
                // Validate code files exist
                const missingFiles = await this.validateCodeFiles();
                if (missingFiles.length > 0) {
                    vscode.window.showErrorMessage(
                        `Missing code files:\n${missingFiles.join('\n')}`
                    );
                    return null;
                }
                
                progress.report({ message: "Building cartridge..." });
                
                // Build the cartridge
                const cartridgePath = await this.cartridgeBuilder.buildCartridge(
                    projectRoot,
                    currentProject
                );
                
                progress.report({ message: "Build complete!" });
                
                return cartridgePath;
                
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`Build failed: ${errorMessage}`);
                return null;
            }
        });
    }
    
    /**
     * Build and run current project
     */
    async buildAndRunCurrentProject(): Promise<boolean> {
        if (!this.projectRoot) {
            vscode.window.showErrorMessage('No project loaded. Please open a TIC-80 project first.');
            return false;
        }
        
        const projectRoot = this.projectRoot;
        
        // Show progress notification
        return await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Build and Run",
            cancellable: true
        }, async (progress, token) => {
            try {
                progress.report({ message: "Building cartridge..." });
                
                // Check if we need to build first
                const config = vscode.workspace.getConfiguration('tic80');
                const autoBuild = config.get<boolean>('autoBuildBeforeRun', true);
                
                let cartridgePath: string | null = null;
                
                if (autoBuild) {
                    // Build the project
                    cartridgePath = await this.buildCurrentProject();
                    if (!cartridgePath) {
                        return false;
                    }
                    
                    progress.report({ message: "Launching TIC-80..." });
                    
                    // Run the cartridge
                    return await this.tic80Runner.runCartridge(cartridgePath, projectRoot);
                } else {
                    // Just run existing cartridge
                    return await this.runCurrentProject();
                }
                
            } catch (error: any) {
                vscode.window.showErrorMessage(`Build and run failed: ${error.message}`);
                return false;
            }
        });
    }
    
    /**
     * Validate that all code files exist
     */
    private async validateCodeFiles(): Promise<string[]> {
        if (!this.currentProject || !this.projectRoot) {
            return ['Project not loaded'];
        }
        
        // Type assertion после проверки
        const projectRoot = this.projectRoot as string;
        const currentProject = this.currentProject as TIC80ProjectConfig;
        
        const missingFiles: string[] = [];
        
        for (const filePath of currentProject.code_files) {
            const exists = await this.cartridgeBuilder.validateFileExists(
                projectRoot,
                filePath
            );
            
            if (!exists) {
                missingFiles.push(filePath);
            }
        }
        
        return missingFiles;
    }
    
    /**
     * Scan for all Lua files in src directory
     */
    async scanForLuaFiles(): Promise<string[]> {
        if (!this.projectRoot) {
            return [];
        }
        
        // Type assertion после проверки
        const projectRoot = this.projectRoot as string;
        
        return await this.cartridgeBuilder.getAllCodeFiles(projectRoot);
    }

    /**
     * Update code files list based on what's in src directory
     */
    async updateCodeFilesList(): Promise<boolean> {
        if (!this.currentProject || !this.projectRoot) {
            return false;
        }
        
        // Type assertion после проверки
        const projectRoot = this.projectRoot as string;
        const currentProject = this.currentProject as TIC80ProjectConfig;
        
        try {
            const luaFiles = await this.scanForLuaFiles();
            
            if (luaFiles.length > 0) {
                currentProject.code_files = luaFiles;
                await this.saveProjectConfig(currentProject);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Failed to update code files:', error);
            return false;
        }
    }

    /**
     * Test TIC-80 installation
     */
    async testTIC80Installation(): Promise<void> {
        const result = await this.tic80Runner.testInstallation();
        
        if (result.success) {
            vscode.window.showInformationMessage(
                `TIC-80 found: ${result.path}\n` +
                (result.version ? `Version: ${result.version}` : '')
            );
        } else {
            vscode.window.showErrorMessage(
                'TIC-80 not found. Please install TIC-80 and configure the path in settings.',
                'Open Settings',
                'Visit TIC-80 Website'
            ).then(choice => {
                if (choice === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'tic80.executablePath');
                } else if (choice === 'Visit TIC-80 Website') {
                    vscode.env.openExternal(vscode.Uri.parse('https://tic80.com/'));
                }
            });
        }
    }
    
    /**
     * Open TIC-80 configuration
     */
    openTIC80Configuration(): void {
        this.tic80Runner.openConfiguration();
    }
}
