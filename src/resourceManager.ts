import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    ResourceType,
    ResourceBank,
    ResourceFile,
    ResourceFiles,
    ResourceConfig,
    RESOURCE_EXTENSIONS,
    RESOURCE_FILENAMES
} from './resourceTypes';

/**
 * Resource Manager - handles TIC-80 resource files
 */
export class ResourceManager {
    
    /**
     * Scan project directory for TIC-80 resource files
     * @param projectPath Root path of the project
     * @returns Map of resources grouped by bank
     */
    async scanResources(projectPath: string): Promise<ResourceFiles> {
        const resources: ResourceFiles = {};
        const assetsPath = path.join(projectPath, 'assets');
        
        // Check if assets directory exists
        if (!fs.existsSync(assetsPath)) {
            return resources;
        }
        
        // Scan for resource files
        await this.scanDirectory(assetsPath, projectPath, resources);
        
        // Scan bank directories (bank_1, bank_2, etc.)
        for (let bank = 1; bank <= 7; bank++) {
            const bankPath = path.join(assetsPath, `bank_${bank}`);
            if (fs.existsSync(bankPath)) {
                await this.scanDirectory(bankPath, projectPath, resources, bank as ResourceBank);
            }
        }
        
        return resources;
    }
    
    /**
     * Scan directory for resource files
     */
    private async scanDirectory(
        dirPath: string,
        projectPath: string,
        resources: ResourceFiles,
        bank: ResourceBank = 0
    ): Promise<void> {
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (!entry.isFile()) {
                    continue;
                }
                
                const fullPath = path.join(dirPath, entry.name);
                const resourceType = this.detectResourceType(entry.name);
                
                if (resourceType) {
                    // Read resource data
                    const data = await fs.promises.readFile(fullPath, 'utf8');
                    
                    // Initialize bank if needed
                    if (!resources[bank]) {
                        resources[bank] = {};
                    }
                    
                    // Store resource
                    resources[bank]![resourceType] = data.trim();
                    
                    console.log(`Found resource: ${ResourceType[resourceType]} in bank ${bank}: ${entry.name}`);
                }
            }
        } catch (error) {
            console.error(`Failed to scan directory ${dirPath}:`, error);
        }
    }
    
    /**
     * Detect resource type from filename
     */
    private detectResourceType(filename: string): ResourceType | null {
        const lowerName = filename.toLowerCase();
        
        // Check each resource type
        for (const [type, extensions] of Object.entries(RESOURCE_EXTENSIONS)) {
            for (const ext of extensions) {
                if (lowerName.endsWith(ext.toLowerCase())) {
                    return type as ResourceType;
                }
            }
            
            // Check if filename starts with resource name
            const resourceName = RESOURCE_FILENAMES[type as ResourceType].toLowerCase();
            if (lowerName.startsWith(resourceName) && 
                (lowerName.endsWith('.txt') || lowerName.endsWith('.tic_data'))) {
                return type as ResourceType;
            }
        }
        
        return null;
    }
    
    /**
     * Format resource data for cartridge
     * @param resourceType Type of resource
     * @param bank Resource bank (0-7)
     * @param data Raw resource data
     * @returns Formatted resource section
     */
    formatResourceSection(resourceType: ResourceType, bank: ResourceBank, data: string): string {
        // Clean and validate data
        const cleanedData = this.cleanResourceData(data);
        
        if (!cleanedData) {
            return '';
        }
        
        // Generate tag name (with bank number for banks 1-7)
        const tagName = bank === 0 ? resourceType : `${resourceType}${bank}`;
        
        // Format lines with 3-digit indices
        const lines = cleanedData.split('\n').map(line => line.trim()).filter(line => line);
        const formattedLines = lines.map(line => {
            // Ensure line starts with 3-digit index
            if (/^\d{1,3}:/.test(line)) {
                const match = line.match(/^(\d{1,3}):(.+)$/);
                if (match) {
                    const index = match[1].padStart(3, '0');
                    const content = match[2];
                    return `-- ${index}:${content}`;
                }
            }
            return line;
        });
        
        // Build resource section
        const section = [
            `-- <${tagName}>`,
            ...formattedLines,
            `-- </${tagName}>`,
            ''
        ];
        
        return section.join('\n');
    }
    
    /**
     * Clean and validate resource data
     */
    private cleanResourceData(data: string): string {
        // Remove empty lines and trim
        const lines = data.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        // Validate each line
        const validLines = lines.filter(line => {
            // Check if line matches TIC-80 resource format
            // Format: INDEX:DATA where INDEX is 1-3 digits, DATA is hex
            if (/^\d{1,3}:[0-9a-f]+$/i.test(line)) {
                return true;
            }
            
            // Also allow lines without index (just hex data)
            if (/^[0-9a-f]+$/i.test(line)) {
                return true;
            }
            
            console.warn(`Invalid resource data line: ${line.substring(0, 50)}...`);
            return false;
        });
        
        // Add indices if missing
        const linesWithIndices = validLines.map((line, index) => {
            if (/^\d{1,3}:/i.test(line)) {
                return line; // Already has index
            }
            
            // Add 3-digit index
            const paddedIndex = (index + 1).toString().padStart(3, '0');
            return `${paddedIndex}:${line}`;
        });
        
        return linesWithIndices.join('\n');
    }
    
    /**
     * Get all resources formatted for cartridge
     * @param resources Resource files map
     * @returns Formatted resource sections
     */
    getAllResourcesFormatted(resources: ResourceFiles): string {
        const sections: string[] = [];
        
        // Process banks in order (0-7)
        for (let bank = 0; bank <= 7; bank++) {
            const bankResources = resources[bank];
            if (!bankResources) {
                continue;
            }
            
            // Process resource types in specific order (as per TIC-80 spec)
            const resourceOrder: ResourceType[] = [
                ResourceType.TILES,
                ResourceType.SPRITES,
                ResourceType.MAP,
                ResourceType.WAVES,
                ResourceType.SFX,
                ResourceType.PATTERNS,
                ResourceType.TRACKS,
                ResourceType.SCREEN,
                ResourceType.PALETTE
            ];
            
            for (const resourceType of resourceOrder) {
                const data = bankResources[resourceType];
                if (data) {
                    const section = this.formatResourceSection(
                        resourceType,
                        bank as ResourceBank,
                        data
                    );
                    
                    if (section) {
                        sections.push(section);
                    }
                }
            }
        }
        
        return sections.join('\n');
    }
    
    /**
     * Validate resource files
     */
    async validateResources(projectPath: string): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];
        const resources = await this.scanResources(projectPath);
        
        // Check each resource for basic validity
        for (const [bankStr, bankResources] of Object.entries(resources)) {
            const bank = parseInt(bankStr);
            
            for (const [resourceType, data] of Object.entries(bankResources)) {
                const resourceData = data as string;
                if (!resourceData || resourceData.trim().length === 0) {
                    errors.push(`Empty resource: ${resourceType} in bank ${bank}`);
                    continue;
                }

                
                // Basic format validation
                const lines = resourceData.split('\n');
                for (let i = 0; i < Math.min(lines.length, 10); i++) { // Check first 10 lines
                    const line = lines[i].trim();
                    if (line && !/^(\d{1,3}:)?[0-9a-f]+$/i.test(line)) {
                        errors.push(`Invalid format in ${resourceType} bank ${bank}, line ${i + 1}: ${line.substring(0, 30)}...`);
                    }
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Create empty template files for missing resources
     */
    async createResourceTemplates(projectPath: string): Promise<void> {
        const assetsPath = path.join(projectPath, 'assets');
        
        // Create assets directory if it doesn't exist
        await fs.promises.mkdir(assetsPath, { recursive: true });
        
        // Create bank directories
        for (let bank = 1; bank <= 7; bank++) {
            const bankPath = path.join(assetsPath, `bank_${bank}`);
            await fs.promises.mkdir(bankPath, { recursive: true });
        }
        
        vscode.window.showInformationMessage('Resource template files created in assets/ directory');
    }
}