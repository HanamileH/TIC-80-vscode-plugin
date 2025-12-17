import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    ResourceType,
    ResourceBank,
    ResourceFiles,
    ResourceConfig,
    RESOURCE_FILENAMES
} from './resourceTypes';

/**
 * Parser for TIC-80 cartridge files to extract resources
 */
export class CartridgeParser {
    
    /**
     * Parse cartridge file and extract all resources
     */
    async parseCartridge(cartridgePath: string): Promise<ResourceFiles> {
        const resources: ResourceFiles = {};
        
        try {
            // Read cartridge file
            const content = await fs.promises.readFile(cartridgePath, 'utf8');
            const lines = content.split('\n');
            
            let currentBank: ResourceBank = 0;
            let currentType: ResourceType | null = null;
            let inResource = false;
            let resourceData: string[] = [];
            
            for (const line of lines) {
                const trimmed = line.trim();
                
                // Check for resource start tag (with -- comment)
                const startMatch = trimmed.match(/^-- <(\w+)(\d?)>$/);
                if (startMatch) {
                    const [, tag, bankNum] = startMatch;
                    
                    // Determine resource type and bank
                    const { type, bank } = this.parseResourceTag(tag, bankNum);
                    if (type) {
                        currentType = type;
                        currentBank = bank;
                        inResource = true;
                        resourceData = [];
                        continue;
                    }
                }
                
                // Check for resource end tag (with -- comment)
                const endMatch = trimmed.match(/^-- <\/(\w+)(\d?)>$/);
                if (endMatch) {
                    const [, tag, bankNum] = endMatch;
                    
                    // Validate closing tag matches opening tag
                    const { type, bank } = this.parseResourceTag(tag, bankNum);
                    if (type === currentType && bank === currentBank && inResource) {
                        // Save collected resource data
                        if (currentType && resourceData.length > 0) {
                            if (!resources[bank]) {
                                resources[bank] = {};
                            }
                            
                            // Clean and join resource data (remove -- prefix)
                            const cleanedData = this.cleanResourceLines(resourceData);
                            if (cleanedData) {
                                resources[bank]![currentType] = cleanedData;
                            }
                        }
                        
                        // Reset for next resource
                        currentType = null;
                        currentBank = 0;
                        inResource = false;
                        resourceData = [];
                    }
                    continue;
                }
                
                // Collect resource data lines (remove -- prefix if present)
                if (inResource && trimmed) {
                    // Remove -- comment prefix if present
                    let dataLine = trimmed;
                    if (dataLine.startsWith('-- ')) {
                        dataLine = dataLine.substring(3); // Remove '-- '
                    } else if (dataLine.startsWith('--')) {
                        dataLine = dataLine.substring(2); // Remove '--'
                    }
                    
                    // Only add non-empty lines
                    if (dataLine.trim()) {
                        resourceData.push(dataLine);
                    }
                }
            }
            
            return resources;
            
        } catch (error) {
            console.error('Failed to parse cartridge:', error);
            return {};
        }
    }
    
    /**
     * Parse resource tag to determine type and bank
     */
    private parseResourceTag(tag: string, bankNum: string): { type: ResourceType | null; bank: ResourceBank } {
        // Check if tag ends with bank number (1-7)
        let typeName = tag;
        let bank: ResourceBank = 0;
        
        if (bankNum && /^[1-7]$/.test(bankNum)) {
            bank = parseInt(bankNum) as ResourceBank;
            typeName = tag.slice(0, -1); // Remove bank number
        }
        
        // Map tag to ResourceType
        const type = Object.values(ResourceType).find(
            t => t === typeName || t.toLowerCase() === typeName.toLowerCase()
        ) as ResourceType | undefined;
        
        return { type: type || null, bank };
    }
    
    /**
     * Clean and format resource lines (from cartridge format to file format)
     */
    private cleanResourceLines(lines: string[]): string {
        const cleanedLines = lines
            .map(line => {
                // Remove any remaining -- prefixes
                let cleanLine = line;
                if (cleanLine.startsWith('-- ')) {
                    cleanLine = cleanLine.substring(3);
                } else if (cleanLine.startsWith('--')) {
                    cleanLine = cleanLine.substring(2);
                }
                return cleanLine.trim();
            })
            .filter(line => line.length > 0)
            .map(line => {
                // Ensure consistent format: INDEX:DATA
                if (/^\d{1,3}:[0-9a-f]+$/i.test(line)) {
                    const [index, data] = line.split(':');
                    const paddedIndex = index.padStart(3, '0');
                    return `${paddedIndex}:${data}`;
                }
                // If no index, return as is (will be indexed later)
                return line;
            });
        
        return cleanedLines.join('\n');
    }
    
    /**
     * Compare two resource sets and detect changes
     */
    compareResources(
        oldResources: ResourceFiles,
        newResources: ResourceFiles
    ): ResourceComparisonResult {
        const result: ResourceComparisonResult = {
            changed: false,
            added: [],
            removed: [],
            modified: [],
            unchanged: []
        };
        
        // Collect all resource keys from both sets
        const allBanks = new Set([
            ...Object.keys(oldResources).map(Number),
            ...Object.keys(newResources).map(Number)
        ]);
        
        for (const bank of allBanks) {
            const oldBank = oldResources[bank] || {};
            const newBank = newResources[bank] || {};
            
            // Collect all resource types in this bank
            const allTypes = new Set([
                ...Object.keys(oldBank),
                ...Object.keys(newBank)
            ]) as Set<ResourceType>;
            
            for (const type of allTypes) {
                const oldData = oldBank[type];
                const newData = newBank[type];
                
                if (!oldData && newData) {
                    // Resource added
                    result.added.push({
                        type,
                        bank: bank as ResourceBank,
                        data: newData
                    });
                    result.changed = true;
                } else if (oldData && !newData) {
                    // Resource removed
                    result.removed.push({
                        type,
                        bank: bank as ResourceBank,
                        data: oldData
                    });
                    result.changed = true;
                } else if (oldData && newData && oldData !== newData) {
                    // Resource modified
                    result.modified.push({
                        type,
                        bank: bank as ResourceBank,
                        oldData,
                        newData
                    });
                    result.changed = true;
                } else if (oldData && newData && oldData === newData) {
                    // Resource unchanged
                    result.unchanged.push({
                        type,
                        bank: bank as ResourceBank,
                        data: oldData
                    });
                }
            }
        }
        
        return result;
    }
    
    /**
     * Extract metadata from cartridge file
     */
    async extractMetadata(cartridgePath: string): Promise<CartridgeMetadata> {
        try {
            const content = await fs.promises.readFile(cartridgePath, 'utf8');
            const lines = content.split('\n');
            
            const metadata: CartridgeMetadata = {
                title: '',
                author: '',
                description: '',
                version: '',
                license: '',
                script: 'lua',
                timestamp: new Date()
            };
            
            for (const line of lines) {
                const trimmed = line.trim();
                
                // Parse metadata comments
                const metaMatch = trimmed.match(/^--\s*(\w+):\s*(.+)$/);
                if (metaMatch) {
                    const [, key, value] = metaMatch;
                    const lowerKey = key.toLowerCase();
                    
                    switch (lowerKey) {
                        case 'title':
                            metadata.title = value;
                            break;
                        case 'author':
                            metadata.author = value;
                            break;
                        case 'desc':
                            metadata.description = value;
                            break;
                        case 'version':
                            metadata.version = value;
                            break;
                        case 'license':
                            metadata.license = value;
                            break;
                        case 'script':
                            metadata.script = value as any;
                            break;
                    }
                }
                
                // Stop parsing at first non-metadata line
                if (!trimmed.startsWith('--') && trimmed !== '') {
                    break;
                }
            }
            
            // Extract build timestamp
            const buildMatch = content.match(/-- Built:\s*(.+)$/m);
            if (buildMatch) {
                try {
                    metadata.timestamp = new Date(buildMatch[1]);
                } catch {
                    // Use file modification time as fallback
                    const stats = await fs.promises.stat(cartridgePath);
                    metadata.timestamp = stats.mtime;
                }
            }
            
            return metadata;
            
        } catch (error) {
            console.error('Failed to extract metadata:', error);
            return {
                title: '',
                author: '',
                description: '',
                version: '',
                license: '',
                script: 'lua',
                timestamp: new Date()
            };
        }
    }
}

/**
 * Resource comparison result
 */
export interface ResourceComparisonResult {
    changed: boolean;
    added: ResourceInfo[];
    removed: ResourceInfo[];
    modified: ModifiedResourceInfo[];
    unchanged: ResourceInfo[];
}

/**
 * Basic resource information
 */
export interface ResourceInfo {
    type: ResourceType;
    bank: ResourceBank;
    data: string;
}

/**
 * Modified resource information
 */
export interface ModifiedResourceInfo {
    type: ResourceType;
    bank: ResourceBank;
    oldData: string;
    newData: string;
}
/**
 * Cartridge metadata
 */
export interface CartridgeMetadata {
    title: string;
    author: string;
    description: string;
    version: string;
    license: string;
    script: 'lua' | 'javascript' | 'fennel' | 'wren' | 'squirrel';
    timestamp: Date;
}