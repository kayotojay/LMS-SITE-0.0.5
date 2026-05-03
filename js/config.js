// LMS Dev Hub — config.js
// ========================================


// =====================================================
// CONSTANTS & STORAGE
// =====================================================
const ROOT_SK='lms_roots_v2';
const SETTINGS_SK='lms_settings_v1';
const ACCENT_COLORS=['#c8f04a','#4af0c8','#f04a4a','#f0a04a','#a04af0','#4a9af0','#f04ac8','#ffffff'];
const PHASE_COLORS=['#c8f04a','#4af0c8','#f04a4a','#f0a04a','#a04af0','#4a9af0'];
const SAVED_THEMES_SK='lms_saved_themes_v1';

let roots=[];
let activeRootId=null;
let D=null;
let SETTINGS={theme:'',accent:'#c8f04a',scanlines:false,compact:false,font:'mono',layout:'',customTheme:null,accentOverridden:false};

// =====================================================
// THEME DEFINITIONS — used for swatch rendering
// =====================================================
const THEME_DEFS = {
  dark: [
    {id:'',      label:'Obsidian', bg:'#07080d', bg2:'#0d0f18', accent:'#c8f04a', accent2:'#4af0c8', accent3:'#a04af0'},
    {id:'slate', label:'Slate',    bg:'#090c14', bg2:'#101520', accent:'#60a0f8', accent2:'#9060f0', accent3:'#f05060'},
    {id:'midnight',label:'Midnight',bg:'#0c0c0e',bg2:'#141416', accent:'#e040c0', accent2:'#f0c040', accent3:'#40d0a0'},
    {id:'abyss', label:'Abyss',   bg:'#060608', bg2:'#0c0c10', accent:'#ff6b6b', accent2:'#4ecdc4', accent3:'#ffe66d'},
    {id:'forest',label:'Forest',  bg:'#060d08', bg2:'#0c160e', accent:'#80e840', accent2:'#f0cc40', accent3:'#f04048'},
    {id:'ember', label:'Ember',   bg:'#0e0804', bg2:'#180e06', accent:'#ff8c20', accent2:'#ffd040', accent3:'#ff4040'},
    {id:'void',  label:'Void',    bg:'#060408', bg2:'#0e080f', accent:'#b060f8', accent2:'#f040a0', accent3:'#f04040'},
    {id:'steel', label:'Steel',   bg:'#080c10', bg2:'#101520', accent:'#38b8e8', accent2:'#ff8040', accent3:'#f04050'},
    {id:'matrix',label:'Matrix',  bg:'#010800', bg2:'#021200', accent:'#00ff80', accent2:'#aaff00', accent3:'#ff4040'},
    {id:'sakura',label:'Sakura',  bg:'#0c0610', bg2:'#160c1e', accent:'#ff50c0', accent2:'#d060ff', accent3:'#ff5050'},
    {id:'solar', label:'Solar',   bg:'#0e0800', bg2:'#180e00', accent:'#ffd000', accent2:'#ff7800', accent3:'#ff3838'},
    {id:'nord',  label:'Nord',    bg:'#1a1e26', bg2:'#22272e', accent:'#88c0d0', accent2:'#a3be8c', accent3:'#bf616a'},
    {id:'dracula',label:'Dracula',bg:'#191a21', bg2:'#21222c', accent:'#50fa7b', accent2:'#ff79c6', accent3:'#ff5555'},
  ],
  light: [
    {id:'parchment',label:'Parchment',bg:'#faf6ee',bg2:'#f2ece0',accent:'#b84000',accent2:'#006878',accent3:'#c82040'},
    {id:'chalk',  label:'Chalk',   bg:'#f8f8f8', bg2:'#f0f0f2', accent:'#3454d1', accent2:'#e8433a', accent3:'#0aa884'},
    {id:'linen',  label:'Linen',   bg:'#f5f0e8', bg2:'#ede7d8', accent:'#2a7a3a', accent2:'#a0281e', accent3:'#c8780a'},
    {id:'arctic', label:'Arctic',  bg:'#f0f6fa', bg2:'#e4eef8', accent:'#005fa8', accent2:'#e85800', accent3:'#c02040'},
  ],
  brand: [
    {id:'youtube', label:'▶ YouTube',bg:'#0a0000',bg2:'#110000',accent:'#ff0000',accent2:'#ff4444',accent3:'#ffaa00'},
    {id:'discord', label:'Discord', bg:'#0e0f11',bg2:'#1e1f22',accent:'#5865f2',accent2:'#7289da',accent3:'#57f287'},
    {id:'twitter', label:'𝕏 Twitter',bg:'#000000',bg2:'#0a0a0a',accent:'#1d9bf0',accent2:'#00ba7c',accent3:'#f4212e'},
    {id:'spacex',  label:'SpaceX',  bg:'#000000',bg2:'#050508',accent:'#ffffff',accent2:'#a0b8e0',accent3:'#4080ff'},
  ]
};
