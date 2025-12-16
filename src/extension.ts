import * as vscode from 'vscode';
import { TIC80Dashboard } from './tic80Dashboard';

/**
 * Extension activation function
 */
export function activate(context: vscode.ExtensionContext) {
    
    console.log('TIC-80 Extension activated');
    
    // Register hello world command
    const helloDisposable = vscode.commands.registerCommand('tic80.helloWorld', () => {
        vscode.window.showInformationMessage('Hello from TIC-80 Extension!');
    });
    
    // Register dashboard command
    const dashboardDisposable = vscode.commands.registerCommand('tic80.showDashboard', () => {
        TIC80Dashboard.createOrShow(context.extensionUri);
    });
    
    // Add to subscriptions
    context.subscriptions.push(helloDisposable, dashboardDisposable);
    
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
        // Try to find project.json
        const projectJsonUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'project.json');
        
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