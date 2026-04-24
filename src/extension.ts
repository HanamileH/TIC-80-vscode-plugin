import * as vscode from 'vscode';
import { ProjectManager } from './projectManager';

/**
 * Extension activation function
 */
export function activate(context: vscode.ExtensionContext) {
    
    console.log('TIC-80 Extension activated');
    const projectManager = new ProjectManager(context);

    // Register new project command
    const newProjectDisposable = vscode.commands.registerCommand('tic80.newProject', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            await projectManager.createNewProjectInWorkspace();
        } else {
            await projectManager.createNewProject();
        }
    });
    
    // Register build project command
    const buildDisposable = vscode.commands.registerCommand('tic80.buildProject', async () => {
        const isProject = await projectManager.isTIC80Project();
        
        if (!isProject) {
            vscode.window.showErrorMessage('No TIC-80 project found. Please open a project first.');
            return;
        }
        
        await projectManager.loadProject();
        await projectManager.buildCurrentProject();
    });
    
    // Register run project command
    const runDisposable = vscode.commands.registerCommand('tic80.runProject', async () => {
        const isProject = await projectManager.isTIC80Project();
        
        if (!isProject) {
            vscode.window.showErrorMessage('No TIC-80 project found. Please open a project first.');
            return;
        }
        
        await projectManager.loadProject();
        await projectManager.runCurrentProject();
    });
    
    // Register build and run command
    const buildAndRunDisposable = vscode.commands.registerCommand('tic80.buildAndRun', async () => {
        const isProject = await projectManager.isTIC80Project();
        
        if (!isProject) {
            vscode.window.showErrorMessage('No TIC-80 project found. Please open a project first.');
            return;
        }
        
        await projectManager.loadProject();
        await projectManager.buildAndRunCurrentProject();
    });
    
    // Register test TIC-80 command
    const testTIC80Disposable = vscode.commands.registerCommand('tic80.testTIC80', async () => {
        await projectManager.testTIC80Installation();
    });
    
    // Register open configuration command
    const configDisposable = vscode.commands.registerCommand('tic80.openConfig', () => {
        projectManager.openTIC80Configuration();
    });

    // Register sync resources command
    const syncDisposable = vscode.commands.registerCommand('tic80.syncResources', async () => {
        const isProject = await projectManager.isTIC80Project();
        
        if (!isProject) {
            vscode.window.showErrorMessage('No TIC-80 project found. Please open a project first.');
            return;
        }
        
        await projectManager.loadProject();
        await projectManager.syncResourcesFromCartridge();
    });

    // Register toggle auto-sync command
    const toggleSyncDisposable = vscode.commands.registerCommand('tic80.toggleAutoSync', () => {
        projectManager.toggleAutoSync();
    });
    
    // Register check sync command
    const checkSyncDisposable = vscode.commands.registerCommand('tic80.checkSync', async () => {
        const isProject = await projectManager.isTIC80Project();
        
        if (!isProject) {
            vscode.window.showErrorMessage('No TIC-80 project found. Please open a project first.');
            return;
        }
        
        await projectManager.loadProject();
        await projectManager.checkForResourceChanges();
    });
    
    // Add to subscriptions
    context.subscriptions.push(
        newProjectDisposable,
        buildDisposable,
        runDisposable,
        buildAndRunDisposable,
        testTIC80Disposable,
        configDisposable,
        syncDisposable,
        toggleSyncDisposable,
        checkSyncDisposable
    );
    
    // Start watching when extension activates (if project is loaded)
    setTimeout(async () => {
        const isProject = await projectManager.isTIC80Project();
        if (isProject) {
            await projectManager.loadProject();
        }
    }, 1000);

    // Show activation message
    vscode.window.showInformationMessage('TIC-80 Extension is now active!');
    
    // Check if current workspace is a TIC-80 project
    checkCurrentWorkspace();
}

/**
 * Check if current workspace is a TIC-80 project
 */
async function checkCurrentWorkspace() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (workspaceFolders && workspaceFolders.length > 0) {
        // Try to find tic80_project.json
        const projectJsonUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'tic80_project.json');
        
        try {
            await vscode.workspace.fs.stat(projectJsonUri);
            console.log('TIC-80 project detected in current workspace');
            
            // You could automatically open dashboard here if desired
            // TIC80Dashboard.createOrShow(context.extensionUri);
            
        } catch {
            // Not a TIC-80 project, that's OK
            console.log('Current workspace is not a TIC-80 project');
        }
    }
}

/**
 * Extension deactivation function
 */
export function deactivate() {
    console.log('TIC-80 Extension deactivated');
}
