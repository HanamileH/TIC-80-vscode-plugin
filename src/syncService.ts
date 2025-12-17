import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CartridgeParser, ResourceComparisonResult, ResourceInfo } from './cartridgeParser';
import { ResourceManager } from './resourceManager';
import { ResourceType, ResourceBank, RESOURCE_FILENAMES } from './resourceTypes';

/**
 * Service for synchronizing resources between cartridge and project files
 */
export class SyncService {
    
    private parser: CartridgeParser;
    private resourceManager: ResourceManager;
    private watchers: vscode.FileSystemWatcher[] = [];
    private isSyncing = false;
    private lastSynced = new Map<string, Date>();
    private syncEnabled = true;
    
    constructor() {
        this.parser = new CartridgeParser();
        this.resourceManager = new ResourceManager();
    }
    
    /**
     * Start watching for cartridge changes
     */
    async startWatching(projectPath: string): Promise<void> {
        // Stop existing watchers
        this.stopWatching();
        
        const distPath = path.join(projectPath, 'dist');
        
        // Create dist directory if it doesn't exist
        if (!fs.existsSync(distPath)) {
            await fs.promises.mkdir(distPath, { recursive: true });
        }
        
        // Watch for changes in cartridge files
        const cartridgeWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(distPath, '*.lua')
        );
        
        cartridgeWatcher.onDidChange(async (uri) => {
            await this.handleCartridgeChange(uri.fsPath, projectPath);
        });
        
        this.watchers.push(cartridgeWatcher);
        
        // Also watch for creation/deletion
        cartridgeWatcher.onDidCreate(async (uri) => {
            await this.handleCartridgeChange(uri.fsPath, projectPath);
        });
        
        console.log('Started watching for cartridge changes');
    }
    
    /**
     * Stop all watchers
     */
    stopWatching(): void {
        this.watchers.forEach(watcher => watcher.dispose());
        this.watchers = [];
    }
    
    /**
     * Handle cartridge file change
     */
    private async handleCartridgeChange(cartridgePath: string, projectPath: string): Promise<void> {
        if (this.isSyncing || !this.syncEnabled) {
            return;
        }
        
        // Debounce: ignore changes within 2 seconds
        const now = new Date();
        const lastSynced = this.lastSynced.get(cartridgePath);
        if (lastSynced && (now.getTime() - lastSynced.getTime() < 2000)) {
            return;
        }
        
        this.isSyncing = true;
        
        try {
            // Parse resources from cartridge
            const cartridgeResources = await this.parser.parseCartridge(cartridgePath);
            
            // Scan resources from project files
            const projectResources = await this.resourceManager.scanResources(projectPath);
            
            // Compare resources
            const comparison = this.parser.compareResources(projectResources, cartridgeResources);
            
            if (comparison.changed) {
                // Show notification with options
                await this.showSyncNotification(comparison, cartridgePath, projectPath);
            }
            
            this.lastSynced.set(cartridgePath, now);
            
        } catch (error) {
            console.error('Failed to handle cartridge change:', error);
        } finally {
            this.isSyncing = false;
        }
    }
    
    /**
     * Show notification about resource changes
     */
    private async showSyncNotification(
        comparison: ResourceComparisonResult,
        cartridgePath: string,
        projectPath: string
    ): Promise<void> {
        const changes = [
            comparison.added.length > 0 ? `${comparison.added.length} added` : '',
            comparison.removed.length > 0 ? `${comparison.removed.length} removed` : '',
            comparison.modified.length > 0 ? `${comparison.modified.length} modified` : ''
        ].filter(Boolean).join(', ');
        
        const choice = await vscode.window.showInformationMessage(
            `Cartridge resources changed (${changes}). Apply changes to project?`,
            'Apply Changes',
            'Review Changes',
            'Ignore',
            'Always Ignore'
        );
        
        switch (choice) {
            case 'Apply Changes':
                await this.applyResourceChanges(comparison, projectPath);
                vscode.window.showInformationMessage('Resource changes applied successfully');
                break;
                
            case 'Review Changes':
                await this.showChangeDetails(comparison, cartridgePath, projectPath);
                break;
                
            case 'Always Ignore':
                this.setSyncEnabled(false);
                vscode.window.showInformationMessage('Auto-sync disabled. Enable in TIC-80 settings.');
                break;
                
            case 'Ignore':
                // Do nothing
                break;
        }
    }
    
    /**
     * Show detailed change list
     */
    private async showChangeDetails(
        comparison: ResourceComparisonResult,
        cartridgePath: string,
        projectPath: string
    ): Promise<void> {
        const items: vscode.QuickPickItem[] = [];
        
        // Add added resources
        comparison.added.forEach(resource => {
            items.push({
                label: `$(add) ${resource.type} (Bank ${resource.bank})`,
                description: 'New resource',
                detail: `${resource.data.split('\n').length} lines`
            });
        });
        
        // Add removed resources
        comparison.removed.forEach(resource => {
            items.push({
                label: `$(trash) ${resource.type} (Bank ${resource.bank})`,
                description: 'Resource removed',
                detail: `${resource.data.split('\n').length} lines`
            });
        });
        
        // Add modified resources
        comparison.modified.forEach(resource => {
            const oldLines = resource.oldData.split('\n').length;
            const newLines = resource.newData.split('\n').length;
            items.push({
                label: `$(edit) ${resource.type} (Bank ${resource.bank})`,
                description: 'Resource modified',
                detail: `${oldLines} → ${newLines} lines`
            });
        });
        
        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select resources to apply changes',
            canPickMany: true
        });
        
        if (selection && selection.length > 0) {
            // Apply selected changes
            const selectedTypes = selection.map(item => {
                const match = item.label.match(/\$\([^)]+\)\s+(\w+)\s+\(Bank\s+(\d+)\)/);
                return match ? { type: match[1] as ResourceType, bank: parseInt(match[2]) as ResourceBank } : null;
            }).filter(Boolean);
            
            await this.applySelectedChanges(comparison, selectedTypes as any, projectPath);
            vscode.window.showInformationMessage(`Applied ${selectedTypes.length} resource changes`);
        }
    }
    
    /**
     * Apply selected resource changes
     */
    private async applySelectedChanges(
        comparison: ResourceComparisonResult,
        selected: Array<{ type: ResourceType; bank: ResourceBank }>,
        projectPath: string
    ): Promise<void> {
        const assetsPath = path.join(projectPath, 'assets');
        
        // Apply additions
        for (const resource of comparison.added) {
            if (selected.some(s => s.type === resource.type && s.bank === resource.bank)) {
                await this.saveResourceToFile(resource, assetsPath);
            }
        }
        
        // Apply modifications - используем newData для сохранения
        for (const resource of comparison.modified) {
            if (selected.some(s => s.type === resource.type && s.bank === resource.bank)) {
                // Create resourceToSave object with type, bank, and newData
                const resourceToSave: ResourceInfo = {
                    type: resource.type,
                    bank: resource.bank,
                    data: resource.newData
                };
                await this.saveResourceToFile(resourceToSave, assetsPath);
            }
        }
        
        // Apply removals (delete files)
        for (const resource of comparison.removed) {
            if (selected.some(s => s.type === resource.type && s.bank === resource.bank)) {
                await this.deleteResourceFile(resource, assetsPath);
            }
        }
    }
    
    /**
     * Apply all resource changes
     */
    async applyResourceChanges(comparison: ResourceComparisonResult, projectPath: string): Promise<void> {
        const assetsPath = path.join(projectPath, 'assets');
        
        // Apply additions
        for (const resource of comparison.added) {
            await this.saveResourceToFile(resource, assetsPath);
        }
        
        // Apply modifications - используем newData для сохранения
        for (const resource of comparison.modified) {
            const resourceToSave: ResourceInfo = {
                type: resource.type,
                bank: resource.bank,
                data: resource.newData
            };
            await this.saveResourceToFile(resourceToSave, assetsPath);
        }
        
        // Apply removals
        for (const resource of comparison.removed) {
            await this.deleteResourceFile(resource, assetsPath);
        }
    }

    /**
     * Save resource to file
     */
    private async saveResourceToFile(
        resource: { type: ResourceType; bank: ResourceBank; data: string },
        assetsPath: string
    ): Promise<void> {
        // Determine directory based on bank
        const resourceDir = resource.bank === 0
            ? assetsPath
            : path.join(assetsPath, `bank_${resource.bank}`);
        
        // Create directory if it doesn't exist
        await fs.promises.mkdir(resourceDir, { recursive: true });
        
        // Determine filename
        const baseName = RESOURCE_FILENAMES[resource.type];
        const fileName = `${baseName}.tic_data`;
        const filePath = path.join(resourceDir, fileName);
        
        // Write resource data
        await fs.promises.writeFile(filePath, resource.data, 'utf8');
    }
    
    /**
     * Delete resource file
     */
    private async deleteResourceFile(
        resource: { type: ResourceType; bank: ResourceBank },
        assetsPath: string
    ): Promise<void> {
        // Determine directory based on bank
        const resourceDir = resource.bank === 0
            ? assetsPath
            : path.join(assetsPath, `bank_${resource.bank}`);
        
        // Determine filename
        const baseName = RESOURCE_FILENAMES[resource.type];
        const fileName = `${baseName}.tic_data`;
        const filePath = path.join(resourceDir, fileName);
        
        // Delete file if it exists
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
    }
    
    /**
     * Manually sync cartridge with project
     */
    async manualSync(cartridgePath: string, projectPath: string): Promise<boolean> {
        try {
            // Parse resources from cartridge
            const cartridgeResources = await this.parser.parseCartridge(cartridgePath);
            
            // Scan resources from project files
            const projectResources = await this.resourceManager.scanResources(projectPath);
            
            // Compare resources
            const comparison = this.parser.compareResources(projectResources, cartridgeResources);
            
            if (!comparison.changed) {
                vscode.window.showInformationMessage('No changes detected in cartridge resources');
                return false;
            }
            
            // Show summary
            const changes = [
                comparison.added.length > 0 ? `${comparison.added.length} added` : '',
                comparison.removed.length > 0 ? `${comparison.removed.length} removed` : '',
                comparison.modified.length > 0 ? `${comparison.modified.length} modified` : ''
            ].filter(Boolean).join(', ');
            
            const choice = await vscode.window.showInformationMessage(
                `Found ${changes}. Apply all changes?`,
                'Apply All',
                'Review Changes',
                'Cancel'
            );
            
            if (choice === 'Apply All') {
                await this.applyResourceChanges(comparison, projectPath);
                vscode.window.showInformationMessage('Resource sync completed successfully');
                return true;
            } else if (choice === 'Review Changes') {
                await this.showChangeDetails(comparison, cartridgePath, projectPath);
                return true;
            }
            
            return false;
            
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to sync resources: ${error}`);
            return false;
        }
    }
    
    /**
     * Get sync status
     */
    getSyncStatus(): { enabled: boolean; watching: boolean } {
        return {
            enabled: this.syncEnabled,
            watching: this.watchers.length > 0
        };
    }
    
    /**
     * Enable or disable auto-sync
     */
    setSyncEnabled(enabled: boolean): void {
        this.syncEnabled = enabled;
        
        // Save to workspace state
        const config = vscode.workspace.getConfiguration('tic80');
        config.update('autoSyncResources', enabled, vscode.ConfigurationTarget.Workspace);
    }
    
    /**
     * Check if resources need syncing
     */
    async checkSyncNeeded(cartridgePath: string, projectPath: string): Promise<boolean> {
        try {
            const cartridgeResources = await this.parser.parseCartridge(cartridgePath);
            const projectResources = await this.resourceManager.scanResources(projectPath);
            const comparison = this.parser.compareResources(projectResources, cartridgeResources);
            return comparison.changed;
        } catch {
            return false;
        }
    }
}