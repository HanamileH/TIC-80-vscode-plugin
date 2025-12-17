import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TIC80ProjectConfig, DEFAULT_PROJECT_CONFIG, DEFAULT_LUA_CODE } from './projectTypes';
import { CartridgeBuilder } from './cartridgeBuilder';
import { ResourceManager } from './resourceManager';

/**
 * Project Manager - handles project creation, loading and validation
 */
export class ProjectManager {
    
    private static readonly CONFIG_FILE = 'tic80_project.json';
    private currentProject: TIC80ProjectConfig | null = null;
    private projectRoot: string | null = null;
    private cartridgeBuilder: CartridgeBuilder;
    private resourceManager: ResourceManager;
    
    constructor() {
        this.cartridgeBuilder = new CartridgeBuilder();
        this.resourceManager = new ResourceManager();
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
     * Load project configuration from current workspace
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
            return this.currentProject;
        } catch (error) {
            console.error('Failed to load project:', error);
            return null;
        }
    }

    /**
     * Create resource templates for new project
     */
    private async createResourceTemplates(projectPath: string): Promise<void> {
        await this.resourceManager.createResourceTemplates(projectPath);
    }

    /**
     * Create a new TIC-80 project
     */
    async createNewProject(): Promise<string | null> {
        // Ask user for project location
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
        
        // Ask for project name
        const projectName = await vscode.window.showInputBox({
            prompt: 'Enter project name',
            placeHolder: 'My TIC-80 Game',
            value: 'My TIC-80 Game',
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
            // Update project configuration with user input
            const projectConfig: TIC80ProjectConfig = {
                ...DEFAULT_PROJECT_CONFIG,
                name: projectName,
                cart_metadata: {
                    ...DEFAULT_PROJECT_CONFIG.cart_metadata,
                    title: projectName,
                    author: await this.getAuthorName()
                }
            };
            
            // Create project structure
            await this.createProjectStructure(projectPath, projectConfig);
            
            // Create resource templates
            await this.createResourceTemplates(projectPath);
            
            // Save configuration
            const configPath = path.join(projectPath, ProjectManager.CONFIG_FILE);
            await fs.promises.writeFile(
                configPath,
                JSON.stringify(projectConfig, null, 2),
                'utf8'
            );
            
            // Create main.lua file
            const mainLuaPath = path.join(projectPath, 'src', 'main.lua');
            await fs.promises.writeFile(mainLuaPath, DEFAULT_LUA_CODE, 'utf8');
            
            // Create .gitignore
            const gitignorePath = path.join(projectPath, '.gitignore');
            await fs.promises.writeFile(gitignorePath, 'dist/\n*.tic\n', 'utf8');
            
            // Create empty asset files
            await this.createEmptyAssets(projectPath);
            
            // Set as current project
            this.projectRoot = projectPath;
            this.currentProject = projectConfig;
            
            vscode.window.showInformationMessage(`Project "${projectName}" created successfully!`);
            
            // Open the project in new window
            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(projectPath));
            
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
        await fs.promises.writeFile(
            spritesInfoPath,
            'Place your sprites here (128x128 pixels, indexed colors)\n',
            'utf8'
        );
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
        if (!this.currentProject || !this.projectRoot) {
            vscode.window.showErrorMessage('No project loaded. Please open a TIC-80 project first.');
            return false;
        }
        
        return await this.cartridgeBuilder.buildAndRun(
            this.projectRoot,
            this.currentProject
        );
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
}