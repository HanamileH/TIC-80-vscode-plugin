// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    
    // Register the first command: Show Hello World message
    const disposable = vscode.commands.registerCommand('tic80.helloWorld', () => {
        // Show information message to user
        vscode.window.showInformationMessage('Hello from TIC-80 Extension!');
    });

    // Add the command to the extension's subscriptions
    // This ensures the command is disposed when the extension is deactivated
    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
    // Cleanup code can go here if needed
}