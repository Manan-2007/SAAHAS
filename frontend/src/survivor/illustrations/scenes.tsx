import React from 'react';

// SAHAAS's own illustration kit: flat, geometric, big fields of colour, people
// in ordinary rooms. Nobody performs happiness - they sit, read, rest, keep
// each other company. Limbs are round-capped strokes, heads are circles, faces
// are left to the reader. All scenes are decorative (aria-hidden) and scale to
// their container's width.

const C = {
  ink: 'var(--scene-ink)',
  paper: 'var(--scene-paper)',
  room: 'var(--scene-room)',
  floor: 'var(--scene-floor)',
  wood: 'var(--scene-wood)',
  woodDeep: 'var(--scene-wood-deep)',
  hair: '#1b1512',
  pants: '#2f2d3a',
  skinA: '#8a5a3c',
  skinB: '#b07a55',
  skinC: '#6b4330',
  sun: '#f4c95d',
  sunDeep: '#d9a93a',
  coral: '#ef765a',
  coralDeep: '#c95a41',
  rose: '#e58aae',
  roseDeep: '#c46a8f',
  iris: '#6f8fe8',
  irisDeep: '#4f6fc8',
  sage: '#7dba83',
  sageDeep: '#3f7a48',
  leaf: '#2f6b3a',
  lilac: '#9a82c4',
  lilacDeep: '#7a64a6',
  nightSky: '#2b3454',
  metal: 'var(--scene-metal)',
};

type SceneProps = { className?: string };

const Svg: React.FC<{ viewBox: string; className?: string; children: React.ReactNode }> = ({ viewBox, className = '', children }) => (
  <svg viewBox={viewBox} className={`block w-full h-auto ${className}`} aria-hidden focusable="false" xmlns="http://www.w3.org/2000/svg">
    {children}
  </svg>
);

const Plant: React.FC<{ x: number; y: number; pot?: string; scale?: number }> = ({ x, y, pot = C.coral, scale = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    <ellipse cx="-7" cy="-26" rx="6.5" ry="15" transform="rotate(-28 -7 -26)" fill={C.sage} />
    <ellipse cx="8" cy="-28" rx="6.5" ry="16" transform="rotate(24 8 -28)" fill={C.sageDeep} />
    <ellipse cx="1" cy="-34" rx="5.5" ry="14" fill={C.sage} />
    <path d="M-13 -12 h26 l-3 16 h-20 z" fill={pot} />
    <rect x="-15" y="-15" width="30" height="6" rx="2" fill={pot} opacity="0.85" />
  </g>
);

// ---------------------------------------------------------------- welcome: a window seat at night

export const WindowSeat: React.FC<SceneProps> = ({ className }) => (
  <Svg viewBox="0 0 320 220" className={className}>
    <rect x="8" y="6" width="304" height="200" rx="20" style={{ fill: C.room }} />
    <path d="M8 188 H312 A18 18 0 0 1 294 206 H26 A18 18 0 0 1 8 188 Z" style={{ fill: C.floor }} />
    {/* window */}
    <rect x="178" y="26" width="108" height="122" rx="6" fill={C.nightSky} />
    <circle cx="254" cy="58" r="12" fill={C.sun} />
    <circle cx="202" cy="46" r="1.7" style={{ fill: C.ink }} opacity="0.85" />
    <circle cx="219" cy="72" r="1.3" style={{ fill: C.ink }} opacity="0.7" />
    <circle cx="271" cy="100" r="1.5" style={{ fill: C.ink }} opacity="0.7" />
    <circle cx="206" cy="118" r="1.2" style={{ fill: C.ink }} opacity="0.6" />
    <rect x="178" y="26" width="108" height="122" rx="6" fill="none" style={{ stroke: C.ink }} strokeWidth="5" />
    <path d="M232 26 V148 M178 87 H286" style={{ stroke: C.ink }} strokeWidth="4" />
    {/* curtain */}
    <path d="M166 18 h22 q-10 64 2 138 h-24 z" fill={C.rose} />
    <path d="M166 18 h8 q-6 66 0 138 h-8 z" fill={C.roseDeep} />
    {/* sill + plant */}
    <rect x="170" y="146" width="124" height="8" rx="3" style={{ fill: C.ink }} />
    <Plant x={264} y={144} />
    {/* rug */}
    <rect x="22" y="194" width="160" height="6" rx="3" fill={C.iris} opacity="0.9" />
    {/* armchair */}
    <rect x="36" y="90" width="30" height="100" rx="14" fill={C.lilacDeep} />
    <rect x="36" y="146" width="120" height="36" rx="13" fill={C.lilac} />
    <rect x="46" y="180" width="7" height="12" rx="2" fill={C.lilacDeep} />
    <rect x="140" y="180" width="7" height="12" rx="2" fill={C.lilacDeep} />
    {/* person: legs */}
    <path d="M84 152 L128 150" stroke={C.pants} strokeWidth="18" strokeLinecap="round" />
    <path d="M128 150 L134 186" stroke={C.pants} strokeWidth="15" strokeLinecap="round" />
    <ellipse cx="141" cy="190" rx="11" ry="5" fill={C.hair} />
    {/* torso */}
    <path d="M62 108 C62 97 70 91 81 91 C93 91 100 98 101 109 L104 156 L63 156 Z" fill={C.sun} />
    <path d="M70 94 C78 104 92 104 99 100" stroke={C.coral} strokeWidth="5" strokeLinecap="round" fill="none" />
    <rect x="77" y="80" width="10" height="13" rx="3" fill={C.skinA} />
    {/* head, turned to the window */}
    <circle cx="84" cy="70" r="14" fill={C.skinA} />
    <path d="M70 72 C67 57 78 53 86 54 C94 55 98 60 98 64 C92 61 86 62 82 66 C78 70 76 77 72 82 Z" fill={C.hair} />
    <circle cx="69" cy="63" r="7" fill={C.hair} />
    {/* arm and a warm cup */}
    <path d="M93 106 L104 132" stroke={C.sun} strokeWidth="11" strokeLinecap="round" />
    <path d="M104 132 L119 122" stroke={C.skinA} strokeWidth="9" strokeLinecap="round" />
    <rect x="115" y="107" width="13" height="15" rx="3" style={{ fill: C.ink }} />
    <path d="M128 111 q6 0 6 5 q0 5 -6 5" style={{ stroke: C.ink }} strokeWidth="2.5" fill="none" />
    <path d="M119 101 q-3 -5 0 -9 q3 -4 0 -9" style={{ stroke: C.ink }} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.45" />
    <path d="M125 101 q-3 -5 0 -9 q3 -4 0 -9" style={{ stroke: C.ink }} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.3" />
  </Svg>
);

// ---------------------------------------------------------------- check-in: a sprout in the light (drawn for a yellow card)

export const Sprout: React.FC<SceneProps> = ({ className }) => (
  <Svg viewBox="0 0 160 124" className={className}>
    <path d="M98 0 H142 L112 124 H60 Z" fill="#ffffff" opacity="0.22" />
    <ellipse cx="80" cy="120" rx="44" ry="4" fill="#000000" opacity="0.08" />
    <path d="M52 88 h56 l-6 32 h-44 z" fill={C.coral} />
    <rect x="47" y="82" width="66" height="10" rx="3" fill={C.coralDeep} />
    <path d="M80 84 C80 70 79 60 80 48" stroke={C.leaf} strokeWidth="4" strokeLinecap="round" fill="none" />
    <path d="M80 62 C66 62 57 52 57 41 C70 41 79 49 80 62 Z" fill={C.sageDeep} />
    <path d="M80 54 C93 52 103 42 105 29 C91 29 81 39 80 54 Z" fill={C.leaf} />
  </Svg>
);

// ---------------------------------------------------------------- support: two people, one bench

const Seated: React.FC<{
  x: number;
  top: string;
  skin: string;
  hair: 'long' | 'short' | 'bun';
  tilt?: number;
}> = ({ x, top, skin, hair, tilt = 0 }) => (
  <g transform={`translate(${x} 0)`}>
    {/* shins and feet */}
    <path d="M-9 136 L-10 170" stroke={C.pants} strokeWidth="11" strokeLinecap="round" />
    <path d="M9 136 L10 170" stroke={C.pants} strokeWidth="11" strokeLinecap="round" />
    <ellipse cx="-12" cy="173" rx="8" ry="4" fill={C.hair} />
    <ellipse cx="12" cy="173" rx="8" ry="4" fill={C.hair} />
    {/* lap */}
    <rect x="-22" y="120" width="44" height="20" rx="10" fill={C.pants} />
    {/* torso */}
    <path d="M-19 84 C-19 73 -11 68 0 68 C11 68 19 73 19 84 L21 128 H-21 Z" fill={top} />
    {/* arms resting */}
    <path d="M-17 82 L-20 112 L-8 124" stroke={top} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M17 82 L20 112 L8 124" stroke={top} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="-6" cy="125" r="4.5" fill={skin} />
    <circle cx="6" cy="125" r="4.5" fill={skin} />
    <g transform={`rotate(${tilt} 0 56)`}>
      <rect x="-5" y="56" width="10" height="13" rx="3" fill={skin} />
      <circle cx="0" cy="46" r="13" fill={skin} />
      {hair === 'long' && <path d="M-14 50 C-17 33 -6 29 0 29 C9 29 16 34 15 48 C12 42 6 39 0 39 C-6 39 -10 43 -11 50 L-10 70 H-16 Z" fill={C.hair} />}
      {hair === 'short' && <path d="M-13 44 C-14 32 -6 30 1 30 C9 30 14 35 13 44 C9 39 4 37 0 37 C-5 37 -9 40 -13 44 Z" fill={C.hair} />}
      {hair === 'bun' && (
        <>
          <path d="M-13 46 C-15 33 -6 30 0 30 C8 30 14 34 13 45 C9 40 4 38 0 38 C-6 38 -10 41 -13 46 Z" fill={C.hair} />
          <circle cx="0" cy="27" r="6.5" fill={C.hair} />
        </>
      )}
    </g>
  </g>
);

export const Companions: React.FC<SceneProps> = ({ className }) => (
  <Svg viewBox="0 0 320 196" className={className}>
    <rect x="8" y="4" width="304" height="188" rx="20" style={{ fill: C.room }} />
    <path d="M8 176 H312 A16 16 0 0 1 296 192 H24 A16 16 0 0 1 8 176 Z" style={{ fill: C.floor }} />
    {/* a lamp's circle of warmth */}
    <circle cx="160" cy="70" r="62" fill={C.sun} opacity="0.08" />
    {/* bench */}
    <rect x="46" y="94" width="196" height="12" rx="6" fill={C.coral} />
    <rect x="58" y="106" width="8" height="18" fill={C.coralDeep} />
    <rect x="222" y="106" width="8" height="18" fill={C.coralDeep} />
    <Seated x={112} top={C.lilac} skin={C.skinB} hair="long" tilt={6} />
    <Seated x={172} top={C.iris} skin={C.skinC} hair="short" tilt={-3} />
    <rect x="46" y="128" width="196" height="12" rx="6" fill={C.coral} />
    <rect x="58" y="140" width="8" height="36" fill={C.coralDeep} />
    <rect x="222" y="140" width="8" height="36" fill={C.coralDeep} />
    <Plant x={278} y={172} pot={C.sun} scale={1.35} />
  </Svg>
);

// ---------------------------------------------------------------- prepare: what to bring

export const Desk: React.FC<SceneProps> = ({ className }) => (
  <Svg viewBox="0 0 320 180" className={className}>
    <rect x="8" y="4" width="304" height="172" rx="20" style={{ fill: C.room }} />
    {/* calendar */}
    <rect x="52" y="40" width="80" height="78" rx="7" style={{ fill: C.ink }} />
    <path d="M52 47 a7 7 0 0 1 7 -7 h66 a7 7 0 0 1 7 7 v13 h-80 z" fill={C.rose} />
    <rect x="68" y="34" width="5" height="12" rx="2" fill={C.roseDeep} />
    <rect x="111" y="34" width="5" height="12" rx="2" fill={C.roseDeep} />
    {[0, 1, 2, 3].map((r) =>
      [0, 1, 2, 3, 4].map((c) => (
        <circle key={`${r}-${c}`} cx={64 + c * 14} cy={72 + r * 12} r="2.4" fill={C.pants} opacity="0.35" />
      )),
    )}
    <circle cx="106" cy="84" r="7" fill="none" stroke={C.roseDeep} strokeWidth="2.5" />
    {/* bottle */}
    <rect x="148" y="66" width="18" height="52" rx="6" fill={C.iris} />
    <rect x="151" y="57" width="12" height="11" rx="2" fill={C.irisDeep} />
    {/* tote bag */}
    <path d="M190 118 l6 -46 h52 l6 46 z" fill={C.lilac} />
    <path d="M206 74 C206 56 234 56 234 74" stroke={C.lilacDeep} strokeWidth="4" fill="none" />
    <rect x="212" y="90" width="20" height="14" rx="2" style={{ fill: C.ink }} opacity="0.9" />
    {/* folded papers */}
    <g transform="rotate(-5 110 122)">
      <rect x="84" y="114" width="58" height="8" rx="1.5" style={{ fill: C.paper }} />
      <rect x="88" y="110" width="54" height="6" rx="1.5" style={{ fill: C.ink }} />
    </g>
    <Plant x={282} y={118} pot={C.coral} scale={0.9} />
    {/* table */}
    <rect x="28" y="118" width="264" height="10" rx="4" style={{ fill: C.wood }} />
    <rect x="44" y="128" width="8" height="48" style={{ fill: C.woodDeep }} />
    <rect x="268" y="128" width="8" height="48" style={{ fill: C.woodDeep }} />
  </Svg>
);

// ---------------------------------------------------------------- wellbeing: resting with a book

export const Resting: React.FC<SceneProps> = ({ className }) => (
  <Svg viewBox="0 0 320 180" className={className}>
    <rect x="8" y="4" width="304" height="172" rx="20" style={{ fill: C.room }} />
    {/* lamp and its light */}
    <path d="M258 44 L214 166 H302 Z" fill={C.sun} opacity="0.1" />
    <rect x="256" y="44" width="4" height="120" style={{ fill: C.metal }} opacity="0.85" />
    <ellipse cx="258" cy="166" rx="18" ry="4" style={{ fill: C.metal }} opacity="0.85" />
    <path d="M240 46 L246 26 H270 L276 46 Z" fill={C.sun} />
    {/* mat */}
    <rect x="26" y="148" width="214" height="14" rx="7" fill={C.iris} />
    <ellipse cx="60" cy="140" rx="26" ry="11" fill={C.rose} />
    {/* person lying, knees up */}
    <path d="M146 142 L178 114" stroke={C.pants} strokeWidth="17" strokeLinecap="round" />
    <path d="M178 114 L202 146" stroke={C.pants} strokeWidth="14" strokeLinecap="round" />
    <ellipse cx="208" cy="148" rx="10" ry="5" fill={C.hair} />
    <rect x="72" y="120" width="80" height="28" rx="14" fill={C.sage} />
    <circle cx="60" cy="126" r="13" fill={C.skinB} />
    <path d="M47 128 C44 114 54 110 62 111 C70 112 74 117 73 122 C68 118 62 118 58 121 C54 124 52 130 50 134 Z" fill={C.hair} />
    {/* arms holding a book up */}
    <path d="M92 124 L104 100" stroke={C.sage} strokeWidth="9" strokeLinecap="round" />
    <path d="M104 100 L112 88" stroke={C.skinB} strokeWidth="7" strokeLinecap="round" />
    <path d="M104 86 L118 72 L136 80 L122 94 Z" fill={C.coral} />
    <path d="M104 86 L118 72 L112 70 L98 84 Z" fill={C.coralDeep} />
  </Svg>
);

// ---------------------------------------------------------------- chat: writing it down

export const Notebook: React.FC<SceneProps> = ({ className }) => (
  <Svg viewBox="0 0 300 184" className={className}>
    <rect x="8" y="4" width="284" height="176" rx="20" style={{ fill: C.room }} />
    {/* window light on the wall */}
    <path d="M190 20 H250 L226 110 H166 Z" fill={C.iris} opacity="0.14" />
    {/* cushion */}
    <ellipse cx="126" cy="160" rx="62" ry="12" fill={C.lilac} />
    {/* crossed legs */}
    <path d="M84 150 C100 136 146 136 168 150" stroke={C.pants} strokeWidth="18" strokeLinecap="round" fill="none" />
    <ellipse cx="96" cy="156" rx="9" ry="5" fill={C.hair} />
    <ellipse cx="156" cy="156" rx="9" ry="5" fill={C.hair} />
    {/* torso, leaning over the page */}
    <path d="M104 96 C104 84 113 78 126 78 C139 78 148 84 148 96 L150 142 H102 Z" fill={C.coral} />
    <rect x="121" y="67" width="10" height="13" rx="3" fill={C.skinC} />
    <g transform="rotate(8 126 62)">
      <circle cx="126" cy="58" r="14" fill={C.skinC} />
      <path d="M111 60 C109 44 120 40 127 40 C136 40 141 46 140 58 C135 51 130 49 125 49 C119 49 114 53 111 60 Z" fill={C.hair} />
      <path d="M111 58 C108 70 110 82 116 90" stroke={C.hair} strokeWidth="7" strokeLinecap="round" fill="none" />
    </g>
    {/* notebook and hands */}
    <path d="M108 126 L140 122 L146 138 L112 142 Z" style={{ fill: C.ink }} />
    <path d="M126 124 L129 140" stroke={C.pants} strokeWidth="1.5" opacity="0.3" />
    <path d="M106 96 L100 124 L114 132" stroke={C.coral} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M146 96 L152 120 L138 128" stroke={C.coral} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="116" cy="133" r="4.5" fill={C.skinC} />
    <circle cx="136" cy="129" r="4.5" fill={C.skinC} />
    <path d="M136 129 L144 118" stroke={C.iris} strokeWidth="2.5" strokeLinecap="round" />
    {/* tea */}
    <rect x="212" y="148" width="16" height="16" rx="3" style={{ fill: C.ink }} />
    <path d="M228 152 q6 0 6 5 q0 5 -6 5" style={{ stroke: C.ink }} strokeWidth="2.5" fill="none" />
    <Plant x={256} y={172} pot={C.sun} scale={1.1} />
  </Svg>
);
