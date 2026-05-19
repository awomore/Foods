// FOODSbyme — icon set. Outline only, 1.5px stroke, rounded caps.
function Icon({ name, size = 20, color = 'currentColor', fill, ...rest }) {
  const stroke = color;
  const fillC = fill || 'none';
  const sw = 1.5;
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', ...rest };

  switch (name) {
    case 'home': return (<svg {...common}><path d="M3.5 11.2 12 4.5l8.5 6.7v8.3a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-8.3Z" fill={fillC === 'none' ? 'none' : fillC}/><path d="M9.5 20.5v-5.7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5.7"/></svg>);
    case 'compass': return (<svg {...common}><circle cx="12" cy="12" r="8.5" fill={fillC === 'none' ? 'none' : fillC}/><path d="m9 15 1.8-5.2L16 8l-1.8 5.2L9 15Z"/></svg>);
    case 'user': return (<svg {...common}><circle cx="12" cy="8.5" r="3.5" fill={fillC === 'none' ? 'none' : fillC}/><path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/></svg>);
    case 'bell': return (<svg {...common}><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16Z"/><path d="M10 19.5a2 2 0 0 0 4 0"/></svg>);
    case 'chevron-left': return <svg {...common}><path d="m14 6-6 6 6 6"/></svg>;
    case 'chevron-right': return <svg {...common}><path d="m10 6 6 6-6 6"/></svg>;
    case 'chevron-down': return <svg {...common}><path d="m6 9 6 6 6-6"/></svg>;
    case 'arrow-right': return <svg {...common}><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>;
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>;
    case 'x': return <svg {...common}><path d="m6 6 12 12M6 18 18 6"/></svg>;
    case 'check': return <svg {...common}><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>;
    case 'search': return (<svg {...common}><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/></svg>);
    case 'sliders': return (<svg {...common}><path d="M4 7h12M4 12h6M4 17h10"/><circle cx="18" cy="7" r="2" fill="var(--bg-card)"/><circle cx="13" cy="12" r="2" fill="var(--bg-card)"/><circle cx="16" cy="17" r="2" fill="var(--bg-card)"/></svg>);
    case 'leaf': return (<svg {...common}><path d="M5 19c0-8 7-14 14-14 0 8-6 14-14 14Z"/><path d="M5 19c4-4 7-7 14-14"/></svg>);
    case 'badge-check': return (<svg {...common}><path d="m12 3 2.2 1.7 2.8-.4.8 2.7 2.4 1.5-1 2.6 1 2.6-2.4 1.5-.8 2.7-2.8-.4L12 19l-2.2-1.5-2.8.4-.8-2.7-2.4-1.5 1-2.6-1-2.6L6.2 6.7l.8-2.7 2.8.4L12 3Z"/><path d="m9 12 2 2 4-4"/></svg>);
    case 'flame': return (<svg {...common}><path d="M12 3c2 4 6 5 6 10a6 6 0 1 1-12 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 2-9Z"/></svg>);
    case 'clock': return (<svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 8v4l3 2"/></svg>);
    case 'map-pin': return (<svg {...common}><path d="M19 10.5c0 5.5-7 11-7 11s-7-5.5-7-11a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10.5" r="2.5"/></svg>);
    case 'note': return (<svg {...common}><path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5V4Z"/><path d="M16 4v3h3M8 11h8M8 15h6"/></svg>);
    case 'instagram': return (<svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17" cy="6.5" r="0.8" fill={stroke}/></svg>);
    case 'tiktok': return (<svg {...common}><path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 4c0 2.2 1.8 4 4 4"/></svg>);
    case 'play': return (<svg {...common}><path d="M8 5.5v13l11-6.5L8 5.5Z" fill={stroke === 'currentColor' ? 'currentColor' : stroke}/></svg>);
    case 'camera': return (<svg {...common}><path d="M4.5 7.5h3l1.5-2h6l1.5 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/></svg>);
    case 'star': return (<svg {...common}><path d="m12 3.5 2.7 5.6 6.2.9-4.5 4.4 1.1 6.2L12 17.7l-5.5 2.9 1-6.2-4.5-4.4 6.2-.9L12 3.5Z" fill={fillC}/></svg>);
    case 'heart': return (<svg {...common}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" fill={fillC}/></svg>);
    case 'lock': return (<svg {...common}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></svg>);
    case 'pot': return (<svg {...common}><path d="M4 9h16M5 9h14v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9Z"/><path d="M9 5c0 1.5 1.5 1.5 1.5 3M13 4c0 1.5 1.5 1.5 1.5 3"/><path d="M2 13h2M20 13h2"/></svg>);
    case 'truck': return (<svg {...common}><path d="M3 7h11v9H3V7Z"/><path d="M14 10h4l3 3v3h-7v-6Z"/><circle cx="7" cy="18" r="1.7"/><circle cx="17" cy="18" r="1.7"/></svg>);
    case 'dice': return (<svg {...common}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="16" cy="16" r="1.3" fill="currentColor"/><circle cx="16" cy="8" r="1.3" fill="currentColor"/><circle cx="8" cy="16" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/></svg>);
    case 'tip': return (<svg {...common}><path d="M12 2v20"/><path d="M17 5H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/></svg>);
    case 'message': return (<svg {...common}><path d="M21 12a8 8 0 0 1-12.4 6.7L4 20l1.4-4.4A8 8 0 1 1 21 12Z"/></svg>);
    case 'shop': return (<svg {...common}><path d="M3 8h18l-1.5 11a2 2 0 0 1-2 1.7H6.5a2 2 0 0 1-2-1.7L3 8Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></svg>);
    case 'plus-circle': return (<svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>);
    case 'pin': return (<svg {...common}><path d="M12 2v8l4 4-8 0 4-4V2"/><path d="M12 14v8"/></svg>);
    case 'naira': return (<svg {...common}><path d="M6 4v16M18 4v16M6 8l12 8M6 12h12M6 16h12"/></svg>);
    case 'minus': return <svg {...common}><path d="M5 12h14"/></svg>;
    case 'share': return (<svg {...common}><path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M12 3v12"/><path d="m8 7 4-4 4 4"/></svg>);
    case 'location': return (<svg {...common}><path d="M19 10.5c0 5.5-7 11-7 11s-7-5.5-7-11a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10.5" r="2.5"/></svg>);
    case 'alert': return (<svg {...common}><path d="M12 3.5 2.5 19.5h19L12 3.5Z"/><path d="M12 10v5"/><circle cx="12" cy="17.5" r="0.5" fill="currentColor"/></svg>);
    case 'quote': return (<svg {...common}><path d="M10 11H7a2 2 0 0 1-2-2V7c0-1.1.9-2 2-2h1a2 2 0 0 1 2 2v5c0 3-2 5-4 6"/><path d="M19 11h-3a2 2 0 0 1-2-2V7c0-1.1.9-2 2-2h1a2 2 0 0 1 2 2v5c0 3-2 5-4 6"/></svg>);
    case 'chat': return (<svg {...common}><path d="M21 12a8 8 0 0 1-12.4 6.7L4 20l1.4-4.4A8 8 0 1 1 21 12Z"/></svg>);
    case 'bag': return (<svg {...common}><path d="M3 8h18l-1.5 11a2 2 0 0 1-2 1.7H6.5a2 2 0 0 1-2-1.7L3 8Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></svg>);
    default: return null;
  }
}
window.Icon = Icon;
