/**
 * Interface for TIC-80 cartridge metadata
 * Based on TIC-80 documentation: https://github.com/nesbox/TIC-80/wiki
 */
export interface TIC80CartMetadata {
    title: string;
    description: string;
    author: string;
    version: string;
    license: string;
    script: 'lua' | 'javascript' | 'fennel' | 'wren' | 'squirrel';
    input?: string[];
    saveid?: string;
}

/**
 * Interface for project configuration
 */
export interface TIC80ProjectConfig {
    name: string;
    cart_metadata: TIC80CartMetadata;
    code_files: string[];
    sprites?: string;
    maps?: string;
    music?: string;
    sfx?: string;
}

/**
 * Default project configuration
 */
export const DEFAULT_PROJECT_CONFIG: TIC80ProjectConfig = {
    name: "New TIC-80 Project",
    cart_metadata: {
        title: "New TIC-80 Game",
        description: "A game made with TIC-80",
        author: "Developer",
        version: "0.1.0",
        license: "MIT",
        script: "lua",
        input: ["mouse", "keyboard", "gamepad"]
    },
    code_files: ["src/main.lua"]
};

/**
 * Project structure template
 */
export const PROJECT_STRUCTURE = [
    "src/",
    "src/main.lua",
    "assets/",
    "assets/sprites.png",
    "assets/music/",
    "assets/sfx/",
    "assets/maps/",
    "dist/",
    ".gitignore"
];

/**
 * Default Lua code for main.lua
 */
export const DEFAULT_LUA_CODE = `-- TIC-80 game main file
-- Called 60 times per second

function TIC()
    -- Clear screen with black color (0)
    cls(0)
    
    -- Print text at position (10, 10) with color 15 (white)
    print("HELLO TIC-80!", 10, 10, 15)
    
    -- Draw a rectangle at (80, 60) with size 40x40, color 12
    rect(80, 60, 40, 40, 12)
    
    -- Draw a filled rectangle at (85, 65) with size 30x30, color 3
    rectb(85, 65, 30, 30, 3)
end
`;