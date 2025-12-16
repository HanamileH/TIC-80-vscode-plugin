import * as vscode from 'vscode';
import * as path from 'path';

/**
 * TIC80Dashboard - WebView panel for TIC-80 extension
 */
export class TIC80Dashboard {
    
    // Current panel instance
    public static currentPanel: TIC80Dashboard | undefined;
    
    // Panel reference
    private readonly _panel: vscode.WebviewPanel;
    
    // Disposables for cleanup
    private _disposables: vscode.Disposable[] = [];
    
    /**
     * Private constructor
     */
    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        
        // Set WebView options
        this._panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [extensionUri]
        };
        
        // Set HTML content
        this._setWebviewContent();
        
        // Handle panel disposal
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        
        // Handle messages from WebView
        this._panel.webview.onDidReceiveMessage(
            (message) => {
                this._handleWebViewMessage(message);
            },
            null,
            this._disposables
        );
        
        // Show initial message
        vscode.window.showInformationMessage('TIC-80 Dashboard opened');
    }
    
    /**
     * Create or show the dashboard panel
     */
    public static createOrShow(extensionUri: vscode.Uri) {
        // If panel already exists, show it
        if (TIC80Dashboard.currentPanel) {
            TIC80Dashboard.currentPanel._panel.reveal(vscode.ViewColumn.Two);
            return;
        }
        
        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            'tic80Dashboard',
            'TIC-80 Dashboard',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        
        TIC80Dashboard.currentPanel = new TIC80Dashboard(panel, extensionUri);
    }
    
    /**
     * Set HTML content for WebView
     */
    private _setWebviewContent() {
        this._panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                    padding: 20px;
                    margin: 0;
                }
                
                .container {
                    max-width: 800px;
                    margin: 0 auto;
                }
                
                h1 {
                    color: var(--vscode-foreground);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 10px;
                }
                
                .buttons {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    item-width: 100%;
                    margin: 20px 0;
                }
                
                button {
                    background: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 10px 15px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-family: inherit;
                }
                
                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }
                
                .log {
                    background: var(--vscode-textBlockQuote-background);
                    border-left: 3px solid var(--vscode-textLink-foreground);
                    padding: 10px;
                    margin-top: 20px;
                    font-family: monospace;
                    font-size: 12px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>TIC-80 Studio dashboard</h1>
                
                <div class="buttons">
                    <button onclick="sendMessage('createProject')">Create new Project</button>
                    <button onclick="sendMessage('buildProject')">Build Project</button>
                    <button onclick="sendMessage('runProject')">Run Project</button>
                </div>
                
                <h3>Messages from Extension:</h3>
                <div id="messages" class="log">
                    No messages yet...
                </div>
                
                <h3>Instructions:</h3>
                <ol>
                    <li>Create a new TIC-80 project</li>
                    <li>Edit your game code</li>
                    <li>Build the cartridge</li>
                    <li>Run in TIC-80</li>
                </ol>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                // Message queue
                let messageQueue = [];
                
                // Send message to extension
                function sendMessage(command) {
                    vscode.postMessage({
                        command: command,
                        timestamp: new Date().toISOString()
                    });
                    addMessage('→ Sent: ' + command);
                }
                
                // Add message to log
                function addMessage(text) {
                    messageQueue.push(text);
                    if (messageQueue.length > 10) {
                        messageQueue.shift();
                    }
                    
                    const messagesDiv = document.getElementById('messages');
                    messagesDiv.innerHTML = messageQueue.map(msg => 
                        '<div>' + msg + '</div>'
                    ).join('');
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }
                
                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    addMessage('← Received: ' + JSON.stringify(message));
                });
                
                // Initial message
                addMessage('WebView loaded successfully');
                
                // Send ready message
                setTimeout(() => {
                    vscode.postMessage({ command: 'webviewReady' });
                }, 100);
            </script>
        </body>
        </html>`;
    }
    
    /**
     * Handle messages from WebView
     */
    private _handleWebViewMessage(message: any) {
        console.log('Message from WebView:', message);
        
        switch (message.command) {
            case 'webviewReady':
                this._panel.webview.postMessage({
                    command: 'welcome',
                    text: 'Dashboard WebView is ready!'
                });
                break;
                
            case 'createProject':
                vscode.window.showInformationMessage('Create Project feature coming soon!');
                this._panel.webview.postMessage({
                    command: 'actionResponse',
                    text: 'Create project action received'
                });
                break;
                
            case 'buildProject':
                vscode.window.showInformationMessage('Build Project feature coming soon!');
                this._panel.webview.postMessage({
                    command: 'actionResponse',
                    text: 'Build project action received'
                });
                break;
                
            case 'runProject':
                vscode.window.showInformationMessage('Run Project feature coming soon!');
                this._panel.webview.postMessage({
                    command: 'actionResponse',
                    text: 'Run project action received'
                });
                break;
        }
    }
    
    /**
     * Cleanup resources
     */
    public dispose() {
        TIC80Dashboard.currentPanel = undefined;
        this._panel.dispose();
        
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}