/**
 * Resource types supported by TIC-80
 */
export enum ResourceType {
    TILES = 'TILES',
    SPRITES = 'SPRITES',
    MAP = 'MAP',
    WAVES = 'WAVES',
    SFX = 'SFX',
    PATTERNS = 'PATTERNS',
    TRACKS = 'TRACKS',
    SCREEN = 'SCREEN',
    PALETTE = 'PALETTE'
}

/**
 * Resource bank (0-7)
 * Bank 0 is default and doesn't have number suffix
 */
export type ResourceBank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Resource file representation
 */
export interface ResourceFile {
    type: ResourceType;
    bank: ResourceBank;
    data: string;  // Raw TIC-80 binary data in hex format
}

/**
 * Resource file configuration
 */
export interface ResourceConfig {
    [ResourceType.TILES]?: string;
    [ResourceType.SPRITES]?: string;
    [ResourceType.MAP]?: string;
    [ResourceType.WAVES]?: string;
    [ResourceType.SFX]?: string;
    [ResourceType.PATTERNS]?: string;
    [ResourceType.TRACKS]?: string;
    [ResourceType.SCREEN]?: string;
    [ResourceType.PALETTE]?: string;
}

/**
 * All resource files grouped by bank
 */
export interface ResourceFiles {
    [bank: number]: ResourceConfig;
}

/**
 * File extensions for TIC-80 resources
 */
export const RESOURCE_EXTENSIONS: Record<ResourceType, string[]> = {
    [ResourceType.TILES]: ['.tic_tiles', '.tiles'],
    [ResourceType.SPRITES]: ['.tic_sprites', '.sprites'],
    [ResourceType.MAP]: ['.tic_map', '.map'],
    [ResourceType.WAVES]: ['.tic_waves', '.waves'],
    [ResourceType.SFX]: ['.tic_sfx', '.sfx'],
    [ResourceType.PATTERNS]: ['.tic_patterns', '.patterns'],
    [ResourceType.TRACKS]: ['.tic_tracks', '.tracks'],
    [ResourceType.SCREEN]: ['.tic_screen', '.screen'],
    [ResourceType.PALETTE]: ['.tic_palette', '.palette']
};

/**
 * Resource display names
 */
export const RESOURCE_NAMES: Record<ResourceType, string> = {
    [ResourceType.TILES]: 'Tiles',
    [ResourceType.SPRITES]: 'Sprites',
    [ResourceType.MAP]: 'Map',
    [ResourceType.WAVES]: 'Waves',
    [ResourceType.SFX]: 'Sound Effects',
    [ResourceType.PATTERNS]: 'Patterns',
    [ResourceType.TRACKS]: 'Music Tracks',
    [ResourceType.SCREEN]: 'Screen',
    [ResourceType.PALETTE]: 'Palette'
};

/**
 * Default file names for resources
 */
export const RESOURCE_FILENAMES: Record<ResourceType, string> = {
    [ResourceType.TILES]: 'tiles',
    [ResourceType.SPRITES]: 'sprites',
    [ResourceType.MAP]: 'map',
    [ResourceType.WAVES]: 'waves',
    [ResourceType.SFX]: 'sfx',
    [ResourceType.PATTERNS]: 'patterns',
    [ResourceType.TRACKS]: 'tracks',
    [ResourceType.SCREEN]: 'screen',
    [ResourceType.PALETTE]: 'palette'
};