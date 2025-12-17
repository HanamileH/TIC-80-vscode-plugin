import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { TIC80ProjectConfig } from './projectTypes';
import { ResourceFiles } from './resourceTypes';
import { ResourceManager } from './resourceManager';

/**
 * Cartridge Builder - creates TIC-80 .lua cartridges from project files
 */
export class CartridgeBuilder {
    
    private resourceManager: ResourceManager;
    
    constructor() {
        this.resourceManager = new ResourceManager();
    }

    /**
     * Build a TIC-80 cartridge from project configuration
     * @param projectPath Root path of the project
     * @param config Project configuration
     * @returns Path to the built cartridge or null if failed
     */
    async buildCartridge(projectPath: string, config: TIC80ProjectConfig): Promise<string | null> {
        try {
            // Validate project configuration
            if (!this.validateProjectConfig(config)) {
                throw new Error('Invalid project configuration');
            }
            
            // Scan for resources
            const resources = await this.resourceManager.scanResources(projectPath);
            
            // Validate resources
            const validation = await this.resourceManager.validateResources(projectPath);
            if (!validation.valid) {
                vscode.window.showWarningMessage(
                    `Resource validation warnings:\n${validation.errors.join('\n')}`
                );
            }
            
            // Create dist directory if it doesn't exist
            const distPath = path.join(projectPath, 'dist');
            await fs.promises.mkdir(distPath, { recursive: true });
            
            // Generate cartridge filename
            const cartridgePath = path.join(distPath, `cart.lua`);
            
            // Build cartridge content
            const cartridgeContent = await this.buildCartridgeContent(
                projectPath, 
                config,
                resources
            );
            
            // Write cartridge file
            await fs.promises.writeFile(cartridgePath, cartridgeContent, 'utf8');
            
            // Show success message with resource info
            const resourceCount = this.countResources(resources);
            const message = `Cartridge built successfully: cart.lua`;
            const detail = resourceCount > 0 ? ` (${resourceCount} resources included)` : '';
            vscode.window.showInformationMessage(message + detail);
            
            return cartridgePath;
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to build cartridge: ${errorMessage}`);
            console.error('Build error:', error);
            return null;
        }
    }
    
    /**
     * Count total number of resources
     */
    private countResources(resources: ResourceFiles): number {
        let count = 0;
        for (const bankResources of Object.values(resources)) {
            // Type assertion to ensure bankResources is treated as an object
            const typedBankResources = bankResources as Record<string, unknown>;
            count += Object.keys(typedBankResources).length;
        }
        return count;
    }

    /**
     * Validate project configuration before building
     */
    private validateProjectConfig(config: TIC80ProjectConfig): boolean {
        const errors: string[] = [];
        
        // Check required fields
        if (!config.name || config.name.trim().length === 0) {
            errors.push('Project name is required');
        }
        
        if (!config.cart_metadata.title || config.cart_metadata.title.trim().length === 0) {
            errors.push('Cartridge title is required');
        }
        
        if (!config.cart_metadata.author || config.cart_metadata.author.trim().length === 0) {
            errors.push('Author is required');
        }
        
        if (!config.code_files || config.code_files.length === 0) {
            errors.push('At least one code file is required');
        }
        
        // Show errors if any
        if (errors.length > 0) {
            vscode.window.showErrorMessage(
                `Project validation failed:\n${errors.join('\n')}`
            );
            return false;
        }
        
        return true;
    }
    
    /**
     * Build cartridge content by combining code files
     */
    private async buildCartridgeContent(
        projectPath: string, 
        config: TIC80ProjectConfig,
        resources: ResourceFiles
    ): Promise<string> {
        const lines: string[] = [];
        
        // Add cartridge header with metadata
        lines.push(this.generateCartridgeHeader(config.cart_metadata));
        lines.push(''); // Empty line for separation
        
        // Process each code file
        for (const codeFile of config.code_files) {
            try {
                const fileContent = await this.processCodeFile(projectPath, codeFile);
                lines.push(fileContent);
                lines.push(''); // Empty line between files
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                throw new Error(`Failed to process file ${codeFile}: ${errorMessage}`);
            }
        }
        
        // Add cartridge footer
        lines.push(this.generateCartridgeFooter(resources));
        
        // Add resource sections if any resources exist
        const resourceSections = this.resourceManager.getAllResourcesFormatted(resources);
        if (resourceSections.trim()) {
            lines.push(''); // Empty line before resources
            lines.push('-- ============================================');
            lines.push('-- Resource Data');
            lines.push('-- ============================================');
            lines.push('');
            lines.push(resourceSections);
        }
        
        return lines.join('\n');
    }
    
    /**
     * Generate cartridge header with metadata
     */
    private generateCartridgeHeader(metadata: TIC80ProjectConfig['cart_metadata']): string {
        const headerLines = [
            '-- title: ' + metadata.title,
            '-- author: ' + metadata.author,
            '-- desc: ' + metadata.description,
            '-- script: ' + metadata.script,
            '-- version: ' + metadata.version,
            '-- license: ' + metadata.license,
            '',
            '-- ============================================',
            '-- TIC-80 Cartridge',
            '-- Built with TIC-80 Cartidge Tool Extension',
            '-- ============================================',
            ''
        ];
        
        return headerLines.join('\n');
    }
    
    /**
     * Process a single code file and add file header
     */
    private async processCodeFile(
        projectPath: string, 
        filePath: string
    ): Promise<string> {
        const fullPath = path.join(projectPath, filePath);
        
        // Check if file exists
        if (!fs.existsSync(fullPath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        
        // Read file content
        const content = await fs.promises.readFile(fullPath, 'utf8');
        
        // Generate file header
        const fileHeader = this.generateFileHeader(filePath);
        
        // Combine header and content
        return fileHeader + '\n' + content;
    }
    
    /**
     * Generate header for each code file
     */
    private generateFileHeader(filePath: string): string {
        const separator = '-- ============================================';
        
        return [
            separator,
            `-- File: ${filePath}`,
            separator,
            ''
        ].join('\n');
    }
    
    /**
     * Generate cartridge footer with resource summary
     */
    private generateCartridgeFooter(resources: ResourceFiles): string {
        const resourceCount = this.countResources(resources);
        const bankCount = Object.keys(resources).length;
        
        const footerLines = [
            '-- ============================================',
            '-- End of cartridge',
            `-- Resources included: ${resourceCount}`,
            `-- Resource banks used: ${bankCount}`,
            '-- ============================================',
            '',
        ];
        
        if (resourceCount === 0) {
            footerLines.splice(2, 0, '-- Note: No resource files found in assets/ directory');
        }
        
        // Add resource summary
        if (resourceCount > 0) {
            footerLines.splice(3, 0, '-- Resource summary:');
            for (const [bankStr, bankResources] of Object.entries(resources)) {
                const typedBankResources = bankResources as Record<string, unknown>;
                const bank = bankStr === '0' ? 'Main' : `Bank ${bankStr}`;
                const resourceList = Object.keys(typedBankResources).join(', ');
                footerLines.splice(4, 0, `-- ${bank}: ${resourceList}`);
            }
        }
        
        return footerLines.join('\n');
    }

    /**
     * Check if a file exists and is readable
     */
    async validateFileExists(projectPath: string, filePath: string): Promise<boolean> {
        const fullPath = path.join(projectPath, filePath);
        
        try {
            await fs.promises.access(fullPath, fs.constants.R_OK);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Get list of all code files in the project
     */
    async getAllCodeFiles(projectPath: string): Promise<string[]> {
        const srcPath = path.join(projectPath, 'src');
        const files: string[] = [];
        
        if (!fs.existsSync(srcPath)) {
            return files;
        }
        
        await this.collectLuaFiles(srcPath, projectPath, files);
        return files;
    }
    
    /**
     * Recursively collect Lua files from directory
     */
    private async collectLuaFiles(
        dirPath: string, 
        projectPath: string, 
        files: string[]
    ): Promise<void> {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.relative(projectPath, fullPath);
            
            if (entry.isDirectory()) {
                await this.collectLuaFiles(fullPath, projectPath, files);
            } else if (entry.isFile() && entry.name.endsWith('.lua')) {
                files.push(relativePath);
            }
        }
    }
    
    /**
     * Build and run cartridge immediately
     */
    async buildAndRun(projectPath: string, config: TIC80ProjectConfig): Promise<boolean> {
        const cartridgePath = await this.buildCartridge(projectPath, config);
        
        if (!cartridgePath) {
            return false;
        }
        
        // In future, we'll run the cartridge here
        vscode.window.showInformationMessage(
            `Cartridge built at: ${cartridgePath}\n` +
            'Run functionality will be added in next version'
        );
        
        return true;
    }
}