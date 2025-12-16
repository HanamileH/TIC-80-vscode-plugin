import * as vscode from 'vscode';
import { ProjectManager } from './projectManager';
import { TIC80ProjectConfig } from './projectTypes';

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
    
    // Project manager instance
    private _projectManager: ProjectManager;
    
    /**
     * Private constructor
     */
    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._projectManager = new ProjectManager();
        
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
        
        // Load project if in TIC-80 workspace
        this._loadCurrentProject();
        
        // Listen for workspace changes
        this._setupWorkspaceListeners();
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
     * Set up workspace change listeners
     */
    private _setupWorkspaceListeners() {
        // Reload project when workspace changes
        vscode.workspace.onDidChangeWorkspaceFolders(async () => {
            await this._loadCurrentProject();
            this._updateWebViewProjectInfo();
        });
        
        // Watch for project.json changes
        const configWatcher = vscode.workspace.createFileSystemWatcher('**/project.json');
        configWatcher.onDidChange(async () => {
            await this._loadCurrentProject();
            this._updateWebViewProjectInfo();
        });
        
        this._disposables.push(configWatcher);
    }
    
    /**
     * Load current project if in TIC-80 workspace
     */
    private async _loadCurrentProject() {
        const isProject = await this._projectManager.isTIC80Project();
        
        if (isProject) {
            const project = await this._projectManager.loadProject();
            if (project) {
                console.log('Project loaded:', project.name);
            }
        }
    }
    
    /**
     * Send project info to WebView
     */
    private _updateWebViewProjectInfo() {
        const project = this._projectManager.getCurrentProject();
        
        this._panel.webview.postMessage({
            command: 'projectInfo',
            hasProject: !!project,
            project: project,
            projectRoot: this._projectManager.getProjectRoot()
        });
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
                
                .project-status {
                    background: var(--vscode-editorWidget-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 3px;
                    padding: 15px;
                    margin: 20px 0;
                }
                
                .project-status.no-project {
                    border-left: 4px solid var(--vscode-errorForeground);
                }
                
                .project-status.has-project {
                    border-left: 4px solid var(--vscode-testing-iconPassed);
                }
                
                .project-info {
                    margin-top: 15px;
                    padding: 10px;
                    background: var(--vscode-textBlockQuote-background);
                    border-radius: 3px;
                    font-family: monospace;
                    font-size: 12px;
                    overflow-x: auto;
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
                
                button.primary {
                    background: var(--vscode-button-secondaryBackground);
                }
                
                button.primary:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
                
                .log {
                    background: var(--vscode-textBlockQuote-background);
                    border-left: 3px solid var(--vscode-textLink-foreground);
                    padding: 10px;
                    margin-top: 20px;
                    font-family: monospace;
                    font-size: 12px;
                    max-height: 200px;
                    overflow-y: auto;
                }
                
                .log-entry {
                    margin: 5px 0;
                    padding: 2px 5px;
                    border-radius: 2px;
                }
                
                .log-entry.info {
                    background: var(--vscode-textBlockQuote-background);
                }
                
                .log-entry.success {
                    background: var(--vscode-testing-iconPassed);
                    color: var(--vscode-foreground);
                }
                
                .log-entry.error {
                    background: var(--vscode-testing-iconFailed);
                    color: var(--vscode-foreground);
                }
                
                .hidden {
                    display: none;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎮 TIC-80 Dashboard</h1>
                
                <!-- Project Status Section -->
                <div id="project-status" class="project-status no-project">
                    <h3>Project Status</h3>
                    <p id="no-project-message">
                        No TIC-80 project loaded. 
                        Open a project folder or create a new one.
                    </p>
                    <div id="has-project-message" class="hidden">
                        <p>
                            <strong>Project:</strong> <span id="project-name">Loading...</span>
                            <br>
                            <strong>Location:</strong> <span id="project-path">Loading...</span>
                        </p>
                        <div id="project-details" class="project-info">
                            Loading project details...
                        </div>
                    </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="buttons">
                    <button class="primary" onclick="sendMessage('createProject')">
                        Create New Project
                    </button>
                    <button onclick="sendMessage('openProject')">
                        Open Project Folder
                    </button>
                    <button id="build-btn" onclick="sendMessage('buildProject')" disabled>
                        Build Project
                    </button>
                    <button id="run-btn" onclick="sendMessage('runProject')" disabled>
                        ▶Run in TIC-80
                    </button>
                </div>
                
                <!-- Messages Log -->
                <h3>Activity Log:</h3>
                <div id="messages" class="log">
                    <div class="log-entry info">Dashboard loaded. Waiting for actions...</div>
                </div>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                // State management
                let state = vscode.getState() || {
                    hasProject: false,
                    projectName: null,
                    lastAction: null,
                    logEntries: []
                };
                
                // Message queue for log
                let logEntries = state.logEntries || [];
                
                // Send message to extension
                function sendMessage(command, data = {}) {
                    vscode.postMessage({
                        command: command,
                        ...data
                    });
                    addLogEntry('→ Sent: ' + command, 'info');
                }
                
                // Add entry to log
                function addLogEntry(text, type = 'info') {
                    const entry = {
                        text: text,
                        type: type,
                        timestamp: new Date().toLocaleTimeString()
                    };
                    
                    logEntries.push(entry);
                    if (logEntries.length > 20) {
                        logEntries.shift();
                    }
                    
                    updateLogDisplay();
                    saveState();
                }
                
                // Update log display
                function updateLogDisplay() {
                    const logDiv = document.getElementById('messages');
                    logDiv.innerHTML = logEntries.map(entry => 
                        \`<div class="log-entry \${entry.type}">
                            [\${entry.timestamp}] \${entry.text}
                        </div>\`
                    ).join('');
                    logDiv.scrollTop = logDiv.scrollHeight;
                }
                
                // Update project status display
                function updateProjectStatus(hasProject, project, projectRoot) {
                    const statusDiv = document.getElementById('project-status');
                    const noProjectMsg = document.getElementById('no-project-message');
                    const hasProjectMsg = document.getElementById('has-project-message');
                    
                    if (hasProject && project) {
                        // Update status UI
                        statusDiv.className = 'project-status has-project';
                        noProjectMsg.style.display = 'none';
                        hasProjectMsg.classList.remove('hidden');
                        
                        // Update project info
                        document.getElementById('project-name').textContent = project.name;
                        document.getElementById('project-path').textContent = projectRoot || 'Unknown';
                        
                        // Format and display project details
                        const detailsDiv = document.getElementById('project-details');
                        detailsDiv.innerHTML = \`<pre>\${JSON.stringify(project, null, 2)}</pre>\`;
                        
                        // Enable action buttons
                        document.getElementById('build-btn').disabled = false;
                        document.getElementById('run-btn').disabled = false;
                        
                        state.hasProject = true;
                        state.projectName = project.name;
                        
                        addLogEntry(\`Project "\${project.name}" loaded\`, 'success');
                        
                    } else {
                        // No project loaded
                        statusDiv.className = 'project-status no-project';
                        noProjectMsg.style.display = 'block';
                        hasProjectMsg.classList.add('hidden');
                        
                        // Disable action buttons
                        document.getElementById('build-btn').disabled = true;
                        document.getElementById('run-btn').disabled = true;
                        
                        state.hasProject = false;
                        state.projectName = null;
                    }
                    
                    saveState();
                }
                
                // Save state to persist across reloads
                function saveState() {
                    state.logEntries = logEntries;
                    vscode.setState(state);
                }
                
                // Handle messages from extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.command) {
                        case 'projectInfo':
                            updateProjectStatus(
                                message.hasProject,
                                message.project,
                                message.projectRoot
                            );
                            break;
                            
                        case 'actionResponse':
                            addLogEntry(message.text, 'success');
                            break;
                            
                        case 'error':
                            addLogEntry(message.text, 'error');
                            break;
                            
                        case 'testResponse':
                            addLogEntry(message.text, 'info');
                            break;
                    }
                });
                
                // Request initial project info
                setTimeout(() => {
                    vscode.postMessage({ command: 'getProjectInfo' });
                }, 100);
                
                // Initial log entry
                addLogEntry('Dashboard initialized', 'info');
                updateLogDisplay();
            </script>
        </body>
        </html>`;
    }
    
    /**
     * Handle messages from WebView
     */
    private async _handleWebViewMessage(message: any) {
        console.log('Message from WebView:', message);
        
        switch (message.command) {
            case 'getProjectInfo':
                // Send current project info to WebView
                this._updateWebViewProjectInfo();
                break;
                
            case 'createProject':
                await this._handleCreateProject();
                break;
                
            case 'openProject':
                await this._handleOpenProject();
                break;
                
            case 'buildProject':
                await this._handleBuildProject();
                break;
                
            case 'runProject':
                await this._handleRunProject();
                break;
                
            case 'testMessage':
                vscode.window.showInformationMessage('Test message from WebView!');
                this._panel.webview.postMessage({
                    command: 'testResponse',
                    text: 'Extension received your test message'
                });
                break;
        }
    }
    
    /**
     * Handle create project request
     */
    private async _handleCreateProject() {
        try {
            const projectPath = await this._projectManager.createNewProject();
            
            if (projectPath) {
                this._panel.webview.postMessage({
                    command: 'actionResponse',
                    text: 'Project created successfully!'
                });
                
                // Reload project info after creation
                setTimeout(async () => {
                    await this._loadCurrentProject();
                    this._updateWebViewProjectInfo();
                }, 1000);
            }
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'error',
                text: `Failed to create project: ${error}`
            });
        }
    }
    
    /**
     * Handle open project request
     */
    private async _handleOpenProject() {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Open TIC-80 Project',
            title: 'Select TIC-80 Project Folder'
        });
        
        if (uris && uris.length > 0) {
            // Open the folder in VS Code
            vscode.commands.executeCommand('vscode.openFolder', uris[0]);
            
            this._panel.webview.postMessage({
                command: 'actionResponse',
                text: 'Opening project folder...'
            });
        }
    }
    
    /**
     * Handle build project request
     */
    private async _handleBuildProject() {
        this._panel.webview.postMessage({
            command: 'actionResponse',
            text: 'Build project feature coming soon!'
        });
        vscode.window.showInformationMessage('Build functionality will be implemented next');
    }
    
    /**
     * Handle run project request
     */
    private async _handleRunProject() {
        this._panel.webview.postMessage({
            command: 'actionResponse',
            text: 'Run project feature coming soon!'
        });
        vscode.window.showInformationMessage('Run functionality will be implemented next');
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