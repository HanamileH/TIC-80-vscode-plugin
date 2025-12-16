import * as vscode from 'vscode';
import { TIC80Dashboard } from './tic80Dashboard';

/**
 * Extension activation function
 */
export function activate(context: vscode.ExtensionContext) {
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
}

// This method is called when your extension is deactivated
export function deactivate() {
    // Cleanup code can go here if needed
}