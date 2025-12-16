import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TIC80ProjectConfig, DEFAULT_PROJECT_CONFIG, DEFAULT_LUA_CODE } from './projectTypes';

/**
 * Project Manager - handles project creation, loading and validation
 */
export class ProjectManager {
    
    private static readonly CONFIG_FILE = 'tic80_project.json';
    private currentProject: TIC80ProjectConfig | null = null;
    private projectRoot: string | null = null;
    
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
}