declare module 'troika-three-text' {
 export type PreloadFontOptions={font?:string;characters?:string|string[];sdfGlyphSize?:number;lang?:string}
 export function preloadFont(options:PreloadFontOptions,callback?:()=>void):void
}
