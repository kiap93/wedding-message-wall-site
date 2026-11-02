// Typography helper classes and utilities

export const typography = {
  h1Editorial: 'font-serif text-3xl md:text-4xl lg:text-5xl font-normal tracking-tight text-[#252525] leading-tight',
  h2Editorial: 'font-serif text-2xl md:text-3xl font-normal tracking-tight text-[#252525]',
  h3Editorial: 'font-serif text-xl md:text-2xl font-normal text-[#252525]',
  
  pageTitle: 'text-xl font-semibold tracking-tight text-[#252525]',
  sectionTitle: 'text-base font-semibold tracking-tight text-[#252525]',
  cardTitle: 'text-sm font-medium text-[#252525]',
  
  body: 'text-sm text-[#252525] leading-relaxed',
  bodyMuted: 'text-sm text-[#777777] leading-relaxed',
  caption: 'text-xs text-[#777777]',
  micro: 'text-[11px] text-[#999999]',
  
  monoNumbers: 'font-mono text-xs tabular-nums',
  tableHeader: 'text-xs font-medium text-[#777777]',
} as const;
