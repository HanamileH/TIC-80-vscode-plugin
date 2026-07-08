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
        title: "game title",
        description: "game description",
        author: "game developer, email, etc.",
        version: "0.1",
        license: "MIT License (change this to your license of choice)",
        script: "lua",
        input: ["keyboard"]
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
export const DEFAULT_LUA_CODE = `t=0
x=96
y=24

function TIC()

	if btn(0) then y=y-1 end
	if btn(1) then y=y+1 end
	if btn(2) then x=x-1 end
	if btn(3) then x=x+1 end

	cls(13)
	spr(1+t%60//30*2,x,y,14,3,0,0,2,2)
	print("HELLO WORLD!",84,84)
	t=t+1
end
`;

/**
 * Default tiles data (TIC-80 robot sprite)
 */
export const DEFAULT_TILES_DATA = `001:eccccccccc888888caaaaaaaca888888cacccccccacc0ccccacc0ccccacc0ccc
002:ccccceee8888cceeaaaa0cee888a0ceeccca0ccc0cca0c0c0cca0c0c0cca0c0c
003:eccccccccc888888caaaaaaaca888888cacccccccacccccccacc0ccccacc0ccc
004:ccccceee8888cceeaaaa0cee888a0ceeccca0cccccca0c0c0cca0c0c0cca0c0c
017:cacccccccaaaaaaacaaacaaacaaaaccccaaaaaaac8888888cc000cccecccccec
018:ccca00ccaaaa0ccecaaa0ceeaaaa0ceeaaaa0cee8888ccee000cceeecccceeee
019:cacccccccaaaaaaacaaacaaacaaaaccccaaaaaaac8888888cc000cccecccccec
020:ccca00ccaaaa0ccecaaa0ceeaaaa0ceeaaaa0cee8888ccee000cceeecccceeee
`;

/*
 * Default palette data (TIC-80 default palette)
 */

export const DEFAULT_PALETTE_DATA = `000:1a1c2c5d275db13e53ef7d57ffcd75a7f07038b76425717929366f3b5dc941a6f673eff7f4f4f494b0c2566c86333c57`;