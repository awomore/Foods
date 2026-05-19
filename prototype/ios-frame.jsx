// FOODSbyme — iOS 15 Pro device frame. Wraps screen content with bezel, status bar, Dynamic Island, home indicator.

function IOSDevice({ width = 402, height = 874, dark = false, children }) {
  const bezel = 11;
  const innerW = width - bezel * 2;
  const innerH = height - bezel * 2;
  const ink = dark ? '#FAF6F0' : '#1A1208';
  const bg  = dark ? '#1A1208' : '#FAF6F0';

  return (
    <div style={{
      width, height, background: bg,
      borderRadius: 56,
      border: `${bezel}px solid ${dark ? '#2E1E10' : '#C8BEAE'}`,
      boxShadow: [
        'inset 0 0 0 0.5px rgba(255,255,255,0.07)',
        '0 0 0 1px rgba(0,0,0,0.18)',
        '0 32px 80px rgba(0,0,0,0.45)',
        '0 8px 24px rgba(0,0,0,0.22)',
      ].join(', '),
      position: 'relative', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Physical buttons */}
      <div style={{ position:'absolute', left:-13, top:96,  width:3, height:30, background: dark?'#3A2A1A':'#AFA498', borderRadius:'2px 0 0 2px' }} />
      <div style={{ position:'absolute', left:-13, top:144, width:3, height:52, background: dark?'#3A2A1A':'#AFA498', borderRadius:'2px 0 0 2px' }} />
      <div style={{ position:'absolute', left:-13, top:208, width:3, height:52, background: dark?'#3A2A1A':'#AFA498', borderRadius:'2px 0 0 2px' }} />
      <div style={{ position:'absolute', right:-13, top:136, width:3, height:72, background: dark?'#3A2A1A':'#AFA498', borderRadius:'0 2px 2px 0' }} />

      {/* Screen */}
      <div style={{ width: innerW, height: innerH, background: bg, borderRadius: 46, overflow: 'hidden', position: 'relative' }}>

        {/* Status bar overlay */}
        <div style={{
          position:'absolute', top:0, left:0, right:0, height:52,
          zIndex:200, pointerEvents:'none',
          display:'flex', alignItems:'flex-end',
          paddingBottom:9, paddingLeft:24, paddingRight:20,
        }}>
          <span style={{ fontFamily:'DM Sans,system-ui,sans-serif', fontSize:15, fontWeight:600, color:ink, flex:1, letterSpacing:'-0.3px' }}>9:41</span>

          {/* Dynamic Island */}
          <div style={{
            position:'absolute', top:10, left:'50%', transform:'translateX(-50%)',
            width:124, height:34, background:'#000', borderRadius:20,
          }} />

          {/* Signal + WiFi + Battery */}
          <div style={{ display:'flex', gap:5, alignItems:'center' }}>
            {/* Cellular */}
            <svg width="17" height="11" viewBox="0 0 17 11" fill="none">
              <rect x="0"   y="6"   width="3" height="5" rx="0.6" fill={ink}/>
              <rect x="4.7" y="4"   width="3" height="7" rx="0.6" fill={ink}/>
              <rect x="9.4" y="2"   width="3" height="9" rx="0.6" fill={ink}/>
              <rect x="14"  y="0"   width="3" height="11" rx="0.6" fill={ink}/>
            </svg>
            {/* WiFi */}
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <circle cx="8" cy="10.5" r="1.5" fill={ink}/>
              <path d="M4.5 7.5C5.5 6.5 6.7 5.9 8 5.9s2.5.6 3.5 1.6" stroke={ink} strokeWidth="1.4" strokeLinecap="round" fill="none"/>
              <path d="M1.5 4.5C3.3 2.7 5.5 1.7 8 1.7s4.7 1 6.5 2.8" stroke={ink} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.45"/>
            </svg>
            {/* Battery */}
            <svg width="25" height="11" viewBox="0 0 25 11" fill="none">
              <rect x="0.5" y="0.5" width="20" height="10" rx="3" stroke={ink} strokeOpacity="0.32"/>
              <rect x="2" y="2" width="15" height="7" rx="1.5" fill={ink}/>
              <path d="M22 3.5v4c1-.3 1-3.7 0-4z" fill={ink} fillOpacity="0.35"/>
            </svg>
          </div>
        </div>

        {/* Screen content */}
        <div style={{ position:'absolute', inset:0, overflow:'hidden' }}>
          {children}
        </div>

        {/* Home indicator */}
        <div style={{
          position:'absolute', bottom:8, left:'50%', transform:'translateX(-50%)',
          width:134, height:5,
          background: dark ? 'rgba(250,246,240,0.28)' : 'rgba(26,18,8,0.22)',
          borderRadius:3, zIndex:200, pointerEvents:'none',
        }} />
      </div>
    </div>
  );
}

Object.assign(window, { IOSDevice });
