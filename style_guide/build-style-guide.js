const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak,
  LevelFormat, TabStopType, TabStopPosition
} = require('docx');
const fs = require('fs');

// ─── Brand tokens ────────────────────────────────────────────────
const TEAL     = '1D7874';
const TEAL_DK  = '166A66';
const TEAL_LT  = 'E8F5F4';
const AMBER    = 'F2A63D';
const AMBER_LT = 'FBE9C6';
const CORAL    = 'E87E6A';
const CORAL_LT = 'FAE0DA';
const CHARCOAL = '1A2B29';
const MID_TEAL = '6B8B87';
const CREAM    = 'F0EDE8';
const WHITE    = 'FFFFFF';
const DARK_HDR = '2A3B39';
const BORDER   = 'E5E0D8';

// ─── Page dimensions ─────────────────────────────────────────────
const PW     = 12240; // US Letter width
const PH     = 15840; // US Letter height
const MARG   = 1080;  // 0.75 inch margins
const CW     = PW - MARG * 2; // 10080 content width

// ─── Helpers ─────────────────────────────────────────────────────
const bdr = (color = BORDER, size = 4) => ({ style: BorderStyle.SINGLE, size, color });
const bdrs = (color = BORDER, size = 4) => ({ top: bdr(color,size), bottom: bdr(color,size), left: bdr(color,size), right: bdr(color,size) });
const noBdrs = () => {
  const n = { style: BorderStyle.NONE, size: 0, color: 'auto' };
  return { top: n, bottom: n, left: n, right: n };
};
const shd = (fill) => ({ fill, type: ShadingType.CLEAR });
const marg = (t=80,b=80,l=120,r=80) => ({ top:t, bottom:b, left:l, right:r });

const txt = (text, opts={}) => new TextRun({ text, font:'Arial', size:20, color:CHARCOAL, ...opts });
const code = (text, color=TEAL) => new TextRun({ text, font:'Courier New', size:18, color });

const para = (children, opts={}) => new Paragraph({ spacing:{after:160}, children, ...opts });
const spacer = (before=0, after=200) => new Paragraph({ spacing:{before,after}, children:[] });

const divider = () => new Paragraph({
  spacing:{before:40,after:40},
  border:{ bottom:{ style:BorderStyle.SINGLE, size:4, color:BORDER, space:1 } },
  children:[]
});

const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  children: [new TextRun({ text, font:'Arial', size:40, bold:true, color:TEAL })]
});
const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  children: [new TextRun({ text, font:'Arial', size:28, bold:true, color:CHARCOAL })]
});

const cell = (width, children, fillColor=WHITE, borderColor=BORDER, margins=marg()) =>
  new TableCell({
    width: { size:width, type:WidthType.DXA },
    borders: bdrs(borderColor),
    shading: shd(fillColor),
    margins,
    children: Array.isArray(children) ? children : [children]
  });

const hdrCell = (width, text) => cell(
  width,
  [para([txt(text, {bold:true, color:WHITE, size:18})], {spacing:{after:0}})],
  DARK_HDR, DARK_HDR
);

const bullet = (text) => new Paragraph({
  numbering:{ reference:'bullets', level:0 },
  spacing:{after:80},
  children:[txt(text)]
});

// ─── Color swatch row ─────────────────────────────────────────────
const colorRow = (name, hex, role, usage) => new TableRow({ children:[
  cell(1200, [para([],{spacing:{after:0}})], hex, BORDER, marg(80,80,80,80)),
  cell(2000, [
    para([txt(name,{bold:true,size:20})],{spacing:{after:40}}),
    para([code('#'+hex, MID_TEAL)],{spacing:{after:0}})
  ]),
  cell(1800, [para([txt(role,{color:MID_TEAL,size:18})],{spacing:{after:0}})]),
  cell(5080, [para([txt(usage,{size:18})],{spacing:{after:0}})])
]});

// ─── Type scale row ───────────────────────────────────────────────
const typeRow = (level, sizePx, weight, usage, sample) => {
  const isBold = weight !== '400';
  return new TableRow({ children:[
    cell(2500, [new Paragraph({ spacing:{after:0}, children:[
      new TextRun({ text:sample, font:'Arial', size:parseInt(sizePx)*2, bold:isBold, color:CHARCOAL })
    ]})]),
    cell(1500, [para([txt(level,{bold:true,size:18})],{spacing:{after:0}})]),
    cell(1200, [para([code(`${sizePx}px/${weight}`,MID_TEAL)],{spacing:{after:0}})]),
    cell(4880, [para([txt(usage,{size:18})],{spacing:{after:0}})])
  ]});
};

// ─── Badge row ────────────────────────────────────────────────────
const badgeRow = (label, bgHex, textHex, notes) => new TableRow({ children:[
  cell(2400, [new Paragraph({ alignment:AlignmentType.CENTER, spacing:{after:0}, children:[
    txt(label, {bold:true, size:18, color:textHex})
  ]})], bgHex),
  cell(2400, [
    para([code('bg  #'+bgHex, MID_TEAL)],{spacing:{after:20}}),
    para([code('txt #'+textHex, MID_TEAL)],{spacing:{after:0}})
  ]),
  cell(5280, [para([txt(notes,{size:16})],{spacing:{after:0}})])
]});

// ─── Token code line ──────────────────────────────────────────────
const codeLine = (text, color='E0EDE8') => new Paragraph({
  spacing:{ after:0, line:276, lineRule:'auto' },
  children:[ new TextRun({ text: text||' ', font:'Courier New', size:18, color }) ]
});

// ═════════════════════════════════════════════════════════════════
// DOCUMENT
// ═════════════════════════════════════════════════════════════════
const doc = new Document({
  numbering:{
    config:[{
      reference:'bullets',
      levels:[{ level:0, format:LevelFormat.BULLET, text:'•', alignment:AlignmentType.LEFT,
        style:{ paragraph:{ indent:{ left:720, hanging:360 } } }
      }]
    }]
  },
  styles:{
    default:{ document:{ run:{ font:'Arial', size:22 } } },
    paragraphStyles:[
      { id:'Heading1', name:'Heading 1', basedOn:'Normal', next:'Normal', quickFormat:true,
        run:{ size:40, bold:true, font:'Arial', color:TEAL },
        paragraph:{ spacing:{before:480,after:240}, outlineLevel:0,
          border:{ bottom:{ style:BorderStyle.SINGLE, size:8, color:TEAL, space:4 } }
        }
      },
      { id:'Heading2', name:'Heading 2', basedOn:'Normal', next:'Normal', quickFormat:true,
        run:{ size:28, bold:true, font:'Arial', color:CHARCOAL },
        paragraph:{ spacing:{before:320,after:160}, outlineLevel:1 }
      }
    ]
  },
  sections:[

    // ══════════════════════════════════════════════════════════════
    // COVER PAGE  (zero-margin, full-bleed)
    // ══════════════════════════════════════════════════════════════
    {
      properties:{ page:{ size:{ width:PW, height:PH }, margin:{ top:0, right:0, bottom:0, left:0 } } },
      children:[

        // Teal header block
        new Table({
          width:{ size:PW, type:WidthType.DXA },
          columnWidths:[PW],
          rows:[new TableRow({ children:[
            new TableCell({
              width:{ size:PW, type:WidthType.DXA },
              borders: noBdrs(),
              shading: shd(TEAL),
              margins: marg(2880,2160,2160,2160),
              children:[
                new Paragraph({ spacing:{after:240}, children:[
                  new TextRun({ text:'Kitten', font:'Arial', size:96, bold:true, color:WHITE }),
                  new TextRun({ text:'Tracker', font:'Arial', size:96, bold:true, color:AMBER })
                ]}),
                new Paragraph({ spacing:{after:0}, children:[
                  new TextRun({ text:'Brand & Style Guide', font:'Arial', size:40, color:'A8CFCD' })
                ]}),
                spacer(1200,0),
                new Paragraph({ spacing:{after:0}, children:[
                  new TextRun({ text:'Version 1.0  ·  June 2026', font:'Arial', size:22, color:'7ABAB6' })
                ]})
              ]
            })
          ]})]
        }),

        // Cream lower section
        new Table({
          width:{ size:PW, type:WidthType.DXA },
          columnWidths:[PW],
          rows:[new TableRow({ children:[
            new TableCell({
              width:{ size:PW, type:WidthType.DXA },
              borders: noBdrs(),
              shading: shd(CREAM),
              margins: marg(2160,2880,2160,2160),
              children:[
                new Paragraph({ spacing:{after:400}, children:[
                  new TextRun({ text:'A foster kitten care tracker built for families who save small lives.', font:'Arial', size:32, color:CHARCOAL })
                ]}),
                new Paragraph({ spacing:{after:0}, children:[
                  new TextRun({ text:'This document defines the visual identity, design tokens, and component patterns for Kitten Tracker. It is the single reference for any designer or developer building on or extending the product.', font:'Arial', size:20, color:MID_TEAL })
                ]})
              ]
            })
          ]})]
        })
      ]
    },

    // ══════════════════════════════════════════════════════════════
    // CONTENT PAGES
    // ══════════════════════════════════════════════════════════════
    {
      properties:{ page:{ size:{ width:PW, height:PH }, margin:{ top:MARG, right:MARG, bottom:MARG, left:MARG } } },
      headers:{
        default: new Header({ children:[
          new Paragraph({
            border:{ bottom:{ style:BorderStyle.SINGLE, size:4, color:BORDER, space:4 } },
            spacing:{after:0},
            tabStops:[{ type:TabStopType.RIGHT, position:CW }],
            children:[
              new TextRun({ text:'Kitten', font:'Arial', size:18, bold:true, color:TEAL }),
              new TextRun({ text:'Tracker', font:'Arial', size:18, bold:true, color:AMBER }),
              new TextRun({ text:'\t', font:'Arial', size:18 }),
              new TextRun({ text:'Brand & Style Guide  v1.0', font:'Arial', size:18, color:MID_TEAL })
            ]
          })
        ]})
      },
      footers:{
        default: new Footer({ children:[
          new Paragraph({
            border:{ top:{ style:BorderStyle.SINGLE, size:4, color:BORDER, space:4 } },
            tabStops:[{ type:TabStopType.RIGHT, position:CW }],
            children:[
              new TextRun({ text:'Internal use only', font:'Arial', size:16, color:MID_TEAL }),
              new TextRun({ text:'\t', font:'Arial', size:16 }),
              new TextRun({ children:[PageNumber.CURRENT], font:'Arial', size:16, color:MID_TEAL })
            ]
          })
        ]})
      },
      children:[

        // ── 01 Brand overview ─────────────────────────────────────
        h1('01  Brand overview'),
        para([txt('Kitten Tracker is a web application for foster families to track the medical care, weight, feeding, and status of kittens in their care. The product is built on trust — foster carers rely on it to catch health problems early and coordinate with shelters.')]),
        para([txt('The brand must feel warm and caring without being childish, and professional without being clinical. We serve passionate people doing difficult, important work.')]),
        spacer(80),
        h2('Brand personality'),
        bullet('Warm — approachable, caring, and human without being cute'),
        bullet('Reliable — data is trusted; design is consistent and predictable'),
        bullet('Purposeful — no decorative clutter; every element earns its place'),
        bullet('Professional — used in medical and shelter coordination contexts'),
        spacer(80),
        h2('Brand name'),
        para([txt('Always written as two words in prose: “Kitten Tracker”. Never “KittenTracker”. In the wordmark only, the two words are set without a space and split across two colours (teal + amber). The icon mark is always the cat-head logomark.')]),
        new Paragraph({ children:[new PageBreak()] }),

        // ── 02 Logo ───────────────────────────────────────────────
        h1('02  Logo'),
        para([txt('The logomark is a geometric cat head — two triangular ears atop a rounded-corner rectangle, with vertical-slit pupils and a small amber dot cluster at bottom-right. The dots represent the “tracker” data element and distinguish the mark from a generic cat icon.')]),
        spacer(80),
        h2('Logo variants'),
        new Table({
          width:{ size:CW, type:WidthType.DXA },
          columnWidths:[3360,3360,3360],
          rows:[new TableRow({ children:[
            cell(3360, [
              para([txt('Primary lockup',{bold:true,size:20})],{spacing:{after:60}}),
              para([txt('Icon + wordmark, horizontal',{size:18,color:MID_TEAL})],{spacing:{after:100}}),
              para([txt('Use on cream (#F0EDE8) or white backgrounds.',{size:16,color:MID_TEAL})],{spacing:{after:0}})
            ], CREAM),
            cell(3360, [
              para([txt('Reversed',{bold:true,size:20,color:WHITE})],{spacing:{after:60}}),
              para([txt('White mark on brand teal',{size:18,color:'AACFCD'})],{spacing:{after:100}}),
              para([txt('Use when the brand teal is the background.',{size:16,color:'7ABAB6'})],{spacing:{after:0}})
            ], TEAL),
            cell(3360, [
              para([txt('Icon only',{bold:true,size:20})],{spacing:{after:60}}),
              para([txt('Mark in a teal rounded square',{size:18,color:MID_TEAL})],{spacing:{after:100}}),
              para([txt('For favicons, app icons, and the navigation bar logo slot.',{size:16,color:MID_TEAL})],{spacing:{after:0}})
            ])
          ]})]
        }),
        spacer(200),
        h2('Clear space'),
        para([txt('Maintain clear space of at minimum the height of the cat ears on all sides of the lockup. Never place competing elements closer than this minimum distance.')]),
        spacer(80),
        h2('Incorrect usage'),
        bullet('Do not recolour the logomark outside of the two approved variants'),
        bullet('Do not stretch or distort the mark proportions'),
        bullet('Do not use the wordmark without the icon mark in primary contexts'),
        bullet('Do not place the lockup on a busy or photographic background'),
        bullet('Do not add drop shadows, outlines, glows, or effects to the mark'),
        bullet('Do not rotate the mark'),
        new Paragraph({ children:[new PageBreak()] }),

        // ── 03 Colour ─────────────────────────────────────────────
        h1('03  Colour system'),
        para([txt('Five colours form the complete palette. Forest Teal is the primary brand colour. Harvest Amber provides warm contrast and energy. Kitten Coral is reserved for secondary UI moments. Deep Forest is the primary text colour. Warm Cream is the page background — already present in the existing app and retained in this system.')]),
        spacer(80),
        new Table({
          width:{ size:CW, type:WidthType.DXA },
          columnWidths:[1200,2000,1800,5080],
          rows:[
            new TableRow({ children:[
              hdrCell(1200,'Swatch'), hdrCell(2000,'Name / Hex'), hdrCell(1800,'Token role'), hdrCell(5080,'Usage guidance')
            ]}),
            colorRow('Forest teal',   TEAL,    'Primary',    'CTA buttons, nav active state, primary links, chart lines, icon mark background'),
            colorRow('Harvest amber',  AMBER,   'Accent',     'Wordmark accent, status highlights, the tracker dot motif, warning indicators'),
            colorRow('Kitten coral',   CORAL,   'Secondary',  'Secondary action buttons, gentle callout banners, warm UI accents'),
            colorRow('Deep forest',    CHARCOAL,'Text',       'All body text, headings, table data on light backgrounds'),
            colorRow('Warm cream',    'F0EDE8', 'Background', 'Page/app background, sidebar, card section fills'),
          ]
        }),
        spacer(200),
        h2('Tonal palette — light tints'),
        para([txt('Each primary colour has a light tint for background use. Always use light tints for badge backgrounds; never the full-saturation primary.')]),
        new Table({
          width:{ size:CW, type:WidthType.DXA },
          columnWidths:[3360,3360,3360],
          rows:[new TableRow({ children:[
            cell(3360,[
              para([txt('Teal light  #E8F5F4',{bold:true,size:18,color:TEAL_DK})],{spacing:{after:40}}),
              para([txt('Badge backgrounds, hover fills, info banners',{size:16,color:'4A7A76'})],{spacing:{after:0}})
            ], TEAL_LT, TEAL_LT),
            cell(3360,[
              para([txt('Amber light  #FBE9C6',{bold:true,size:18,color:'A06810'})],{spacing:{after:40}}),
              para([txt('Warning banners, due-soon indicators',{size:16,color:'8A5A14'})],{spacing:{after:0}})
            ], AMBER_LT, AMBER_LT),
            cell(3360,[
              para([txt('Coral light  #FAE0DA',{bold:true,size:18,color:'9E4A38'})],{spacing:{after:40}}),
              para([txt('Secondary hover states, soft accent tags',{size:16,color:'7A3A2C'})],{spacing:{after:0}})
            ], CORAL_LT, CORAL_LT)
          ]})]
        }),
        new Paragraph({ children:[new PageBreak()] }),

        // ── 04 Typography ─────────────────────────────────────────
        h1('04  Typography'),
        para([txt('The Kitten Tracker typeface is Plus Jakarta Sans — a humanist sans-serif on Google Fonts (free). It has the same geometric-humanist structure and warmth as Claude\'s interface typeface, and reads clearly at all sizes from 10px data labels to 36px hero headings.')]),
        spacer(40),
        new Table({
          width:{ size:CW, type:WidthType.DXA },
          columnWidths:[2400,7680],
          rows:[
            new TableRow({ children:[
              cell(2400,[para([txt('Import URL',{bold:true,size:18})],{spacing:{after:0}})]),
              cell(7680,[para([code('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600&display=swap')],{spacing:{after:0}})])
            ]}),
            new TableRow({ children:[
              cell(2400,[para([txt('CSS',{bold:true,size:18})],{spacing:{after:0}})]),
              cell(7680,[para([code("font-family: 'Plus Jakarta Sans', sans-serif;")],{spacing:{after:0}})])
            ]})
          ]
        }),
        spacer(200),
        h2('Type scale'),
        new Table({
          width:{ size:CW, type:WidthType.DXA },
          columnWidths:[2500,1500,1200,4880],
          rows:[
            new TableRow({ children:[ hdrCell(2500,'Sample'), hdrCell(1500,'Level'), hdrCell(1200,'Size/Weight'), hdrCell(4880,'Usage') ]}),
            typeRow('H1','22','500','Page titles — Dashboard, Kittens, Alert center','Dashboard'),
            typeRow('H2','18','500','Section headings — Medical due, Status history','Medical due'),
            typeRow('Body','14','400','Data rows, descriptions, card content, form labels','Beans · 3w 5d'),
            typeRow('Small','12','400','Secondary data, timestamps, metadata, helper text','27-05-2026'),
            typeRow('Label','11','500','Table headers, uppercase tags (letter-spacing: 0.08em)','SHELTER # · AGE'),
          ]
        }),
        spacer(200),
        h2('Weights'),
        para([txt('Two weights only: 400 (regular) for body and data, and 500 (medium) for headings, labels, and interactive elements. Weight 600 is reserved for the wordmark only and must not appear in the UI.')]),
        new Paragraph({ children:[new PageBreak()] }),

        // ── 05 Spacing & Layout ───────────────────────────────────
        h1('05  Spacing & layout'),
        h2('Border radius tokens'),
        new Table({
          width:{ size:CW, type:WidthType.DXA },
          columnWidths:[2400,2000,5680],
          rows:[
            new TableRow({ children:[ hdrCell(2400,'Token'), hdrCell(2000,'Value'), hdrCell(5680,'Usage') ]}),
            ...([
              ['--radius-sm',   '7px',    'Buttons, filter pills, input fields, small badges'],
              ['--radius-md',   '10px',   'Cards, table containers, dropdown menus'],
              ['--radius-lg',   '14px',   'Modal dialogs, large panel sections, logo icon container'],
              ['--radius-pill', '100px',  'Status badges: Intake, In care, Adopted, Deceased'],
            ]).map(([token,val,use]) => new TableRow({ children:[
              cell(2400,[para([code(token)],{spacing:{after:0}})]),
              cell(2000,[para([code(val,CHARCOAL)],{spacing:{after:0}})]),
              cell(5680,[para([txt(use,{size:18})],{spacing:{after:0}})])
            ]}))
          ]
        }),
        spacer(200),
        h2('Spacing scale'),
        para([txt('All spacing uses a base-8 scale. Always reference tokens rather than raw pixel values.')]),
        new Table({
          width:{ size:CW, type:WidthType.DXA },
          columnWidths:[2400,2000,5680],
          rows:[
            new TableRow({ children:[ hdrCell(2400,'Token'), hdrCell(2000,'Value'), hdrCell(5680,'Usage') ]}),
            ...([
              ['--space-xs',  '4px',  'Icon-to-label gap, inline badge padding'],
              ['--space-sm',  '8px',  'Tight row gaps, small input padding'],
              ['--space-md',  '16px', 'Default gap between elements, cell padding'],
              ['--space-lg',  '24px', 'Section padding, card inner padding'],
              ['--space-xl',  '32px', 'Between page sections, modal padding'],
              ['--space-2xl', '48px', 'Between major page-level sections'],
            ]).map(([token,val,use]) => new TableRow({ children:[
              cell(2400,[para([code(token)],{spacing:{after:0}})]),
              cell(2000,[para([code(val,CHARCOAL)],{spacing:{after:0}})]),
              cell(5680,[para([txt(use,{size:18})],{spacing:{after:0}})])
            ]}))
          ]
        }),
        new Paragraph({ children:[new PageBreak()] }),

        // ── 06 Components ─────────────────────────────────────────
        h1('06  Components'),
        h2('Buttons'),
        new Table({
          width:{ size:CW, type:WidthType.DXA },
          columnWidths:[2000,2400,5680],
          rows:[
            new TableRow({ children:[ hdrCell(2000,'Variant'), hdrCell(2400,'States'), hdrCell(5680,'Spec') ]}),
            ...([
              ['Primary',        'Default / Hover / Loading / Disabled', 'bg #1D7874, text white, radius 7px, padding 7px 14px, 13px/500. Hover: bg #166A66. Loading: spinner, pointer-events none. Disabled: opacity 0.45.'],
              ['Ghost',          'Default / Hover',                       '1px border #E5E0D8, bg transparent, text #1A2B29, radius 7px. Hover: border #1D7874, text #1D7874.'],
              ['Destructive',    'Default / Hover',                       'Used for Deceased status only. bg transparent, 1px border #C0392B, text #C0392B. Hover: bg #FDECEA.'],
              ['Icon-prefixed',  'Default / Hover',                       'Primary spec with leading “+” icon. Examples: “+ Add mother”, “+ Litter”, “+ Kitten”.'],
            ]).map(([v,s,spec]) => new TableRow({ children:[
              cell(2000,[para([txt(v,{bold:true,size:18})],{spacing:{after:0}})], 'F5F5F3'),
              cell(2400,[para([txt(s,{size:16,color:MID_TEAL})],{spacing:{after:0}})]),
              cell(5680,[para([txt(spec,{size:16})],{spacing:{after:0}})])
            ]}))
          ]
        }),
        spacer(200),
        h2('Status badges'),
        para([txt('All badges use pill shape (border-radius: 100px), 11px/500 font, sentence case. Padding: 3px 10px.')]),
        new Table({
          width:{ size:CW, type:WidthType.DXA },
          columnWidths:[2400,2400,5280],
          rows:[
            new TableRow({ children:[ hdrCell(2400,'Badge'), hdrCell(2400,'Colours'), hdrCell(5280,'Notes') ]}),
            badgeRow('Intake',              TEAL_LT,  TEAL_DK,  'Kitten has just entered care. Default on registration.'),
            badgeRow('In care',            'E0F0EF',  '156A66', 'Active foster care. Set via profile status change.'),
            badgeRow('Ready for adoption', AMBER_LT, 'B07010',  'Medical clearance done, awaiting placement.'),
            badgeRow('Adopted',            'E8F4E8',  '2E7D32', 'Successfully placed. Read-only state.'),
            badgeRow('Returned to shelter','EEE8F4',  '5C3A8A', 'Returned for any reason. Does not delete record.'),
            badgeRow('Deceased',           'FDECEA',  'C0392B', 'High contrast. Never animate or transition this badge.'),
          ]
        }),
        spacer(200),
        h2('Cards'),
        bullet('Background: white. Border: 1px solid #E5E0D8. Border-radius: 10px. Padding: 14px 16px.'),
        bullet('No box-shadow in default state. On hover (interactive cards): border-color → #1D7874, 150ms ease.'),
        bullet('Mother cards: name 14px/500, status badge top-right, intake date 12px muted, litter count + last health log 12px muted.'),
        bullet('Kitten dashboard cards: 40px avatar circle, name + status badge inline, age · weight 12px muted below.'),
        spacer(100),
        h2('Navigation sidebar'),
        bullet('Width: 220px fixed. Background: #F0EDE8. Right border: 1px solid #E5E0D8.'),
        bullet('Nav item: padding 7px 10px, radius 7px, 13px/400, color #6B8B87, icon 15px left.'),
        bullet('Active: background #1D7874, text white, font-weight 500.'),
        bullet('Hover (inactive): background rgba(29,120,116,0.07), text #1D7874.'),
        bullet('App lockup: 30px icon square (radius 7px) + 15px/600 wordmark. Pinned top.'),
        bullet('User info + logout: 12px muted text pinned to bottom of sidebar.'),
        new Paragraph({ children:[new PageBreak()] }),

        // ── 07 CSS tokens ─────────────────────────────────────────
        h1('07  CSS tokens'),
        para([txt('Copy this block into your global CSS root file. All components should reference these tokens rather than hard-coded values.')]),
        spacer(80),
        new Table({
          width:{ size:CW, type:WidthType.DXA },
          columnWidths:[CW],
          rows:[new TableRow({ children:[
            new TableCell({
              width:{ size:CW, type:WidthType.DXA },
              borders: bdrs(CHARCOAL, 4),
              shading: shd('1A2B29'),
              margins: marg(240,240,280,280),
              children:[
                ...([
                  ['/* Kitten Tracker — design tokens v1.0 */', '7ABAB6'],
                  [':root {',                                       'E0EDE8'],
                  ['',                                              'E0EDE8'],
                  ['  /* Colours */',                               '7ABAB6'],
                  ['  --color-primary:      #1D7874;',              'F2A63D'],
                  ['  --color-primary-lt:   #E8F5F4;',             'F2A63D'],
                  ['  --color-primary-dk:   #166A66;',             'F2A63D'],
                  ['  --color-accent:       #F2A63D;',             'F2A63D'],
                  ['  --color-accent-lt:    #FBE9C6;',             'F2A63D'],
                  ['  --color-secondary:    #E87E6A;',             'F2A63D'],
                  ['  --color-secondary-lt: #FAE0DA;',             'F2A63D'],
                  ['  --color-text:         #1A2B29;',             'F2A63D'],
                  ['  --color-text-muted:   #6B8B87;',             'F2A63D'],
                  ['  --color-bg:           #F0EDE8;',             'F2A63D'],
                  ['  --color-surface:      #FFFFFF;',             'F2A63D'],
                  ['  --color-border:       #E5E0D8;',             'F2A63D'],
                  ['',                                              'E0EDE8'],
                  ['  /* Typography */',                            '7ABAB6'],
                  ["  --font-sans:  'Plus Jakarta Sans', sans-serif;", 'AACFCD'],
                  ['  --font-mono:  monospace;',                   'AACFCD'],
                  ['',                                              'E0EDE8'],
                  ['  /* Border radius */',                         '7ABAB6'],
                  ['  --radius-sm:   7px;',                        'AACFCD'],
                  ['  --radius-md:   10px;',                       'AACFCD'],
                  ['  --radius-lg:   14px;',                       'AACFCD'],
                  ['  --radius-pill: 100px;',                      'AACFCD'],
                  ['',                                              'E0EDE8'],
                  ['  /* Spacing */',                               '7ABAB6'],
                  ['  --space-xs:  4px;',                          'AACFCD'],
                  ['  --space-sm:  8px;',                          'AACFCD'],
                  ['  --space-md:  16px;',                         'AACFCD'],
                  ['  --space-lg:  24px;',                         'AACFCD'],
                  ['  --space-xl:  32px;',                         'AACFCD'],
                  ['  --space-2xl: 48px;',                         'AACFCD'],
                  ['}',                                             'E0EDE8'],
                ]).map(([line,color]) => codeLine(line,color))
              ]
            })
          ]})]
        }),
        new Paragraph({ children:[new PageBreak()] }),

        // ── 08 Voice & tone ───────────────────────────────────────
        h1('08  Voice & tone'),
        para([txt('Kitten Tracker is used by foster carers in high-stakes, often stressful moments — a kitten not gaining weight, a medical alert, a health log at 2am. The writing in the product must match the care that carers bring to their work.')]),
        spacer(80),
        h2('Principles'),
        bullet('Be direct — users are scanning fast; never bury critical data in a sentence.'),
        bullet('Be warm, not cute — this is medical tracking software; carers take it seriously.'),
        bullet('Respect user knowledge — they know what deworming is; don\'t over-explain.'),
        bullet('Confirm, don\'t congratulate — “Weight logged” not “Great job logging that weight!”'),
        bullet('Surface urgency clearly — alerts must be impossible to miss, not buried in muted text.'),
        spacer(80),
        h2('UX copy examples'),
        new Table({
          width:{ size:CW, type:WidthType.DXA },
          columnWidths:[1400,4340,4340],
          rows:[
            new TableRow({ children:[ hdrCell(1400,'Context'), hdrCell(4340,'Write this'), hdrCell(4340,'Not this') ]}),
            ...([
              ['Empty alerts',   'No active warnings.',                                  'Everything looks great! All your kittens are on track!'],
              ['Data missing',   'Fewer than two weighings in the last 48h.',            'We need more data to help you track this kitten\'s progress.'],
              ['Confirm log',    'Weight logged.',                                        'Success! You\'ve successfully logged Beans\' weight!'],
              ['Alert',          'Beans: weight gain below target for 3 days.',          'We noticed Beans might need a little extra attention.'],
              ['Empty state',    'No mothers in care yet.',                               'You haven\'t added any mothers yet — get started!'],
              ['Delete confirm', 'Remove this record? This cannot be undone.',            'Are you sure? This action is permanent and irreversible!'],
            ]).map(([ctx,good,bad]) => new TableRow({ children:[
              cell(1400,[para([txt(ctx,{bold:true,size:16})],{spacing:{after:0}})], 'F5F5F3'),
              cell(4340,[para([txt(good,{size:16,color:'1A5552'})],{spacing:{after:0}})], 'EEF7F6'),
              cell(4340,[para([txt(bad,{size:16,color:'8B3A2A'})],{spacing:{after:0}})], 'FDF2F0')
            ]}))
          ]
        }),

        spacer(400),
        new Paragraph({
          border:{ top:{ style:BorderStyle.SINGLE, size:4, color:BORDER, space:8 } },
          spacing:{ before:200, after:0 },
          children:[
            new TextRun({ text:'Kitten', font:'Arial', size:20, bold:true, color:TEAL }),
            new TextRun({ text:'Tracker', font:'Arial', size:20, bold:true, color:AMBER }),
            new TextRun({ text:'  ·  Brand & Style Guide v1.0  ·  June 2026  ·  For internal use by the design and development team.', font:'Arial', size:18, color:MID_TEAL })
          ]
        })
      ]
    }
  ]
});

// ─── Write file ───────────────────────────────────────────────────
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/sessions/great-focused-davinci/mnt/outputs/kitten-tracker-style-guide.docx', buffer);
  console.log('Done: kitten-tracker-style-guide.docx');
}).catch(err => { console.error(err); process.exit(1); });
