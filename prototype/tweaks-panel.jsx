// FOODSbyme — dev tweaks panel. Floats outside the phone frame on the right edge.

function useTweaks(defaults) {
  const [state, setState] = React.useState(() => {
    try {
      const saved = localStorage.getItem('fbm-tweaks');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch { return defaults; }
  });
  const setTweak = (key, value) => setState(s => {
    const next = { ...s, [key]: value };
    try { localStorage.setItem('fbm-tweaks', JSON.stringify(next)); } catch {}
    return next;
  });
  return [state, setTweak];
}

function TweaksPanel({ title = 'Tweaks', children }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div style={{
      position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)',
      zIndex: 9999, display: 'flex', alignItems: 'flex-start',
    }}>
      {open && (
        <div style={{
          width: 224,
          background: '#1C1208',
          border: '0.5px solid rgba(250,246,240,0.1)',
          borderRight: 'none',
          borderRadius: '14px 0 0 14px',
          padding: '16px 14px',
          display: 'flex', flexDirection: 'column', gap: 10,
          boxShadow: '-8px 0 40px rgba(0,0,0,0.55)',
          maxHeight: '82vh', overflowY: 'auto',
        }}>
          <div style={{
            fontFamily: 'DM Sans,system-ui,sans-serif',
            fontSize: 10, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            color: 'rgba(232,146,74,0.65)',
            paddingBottom: 8, borderBottom: '0.5px solid rgba(250,246,240,0.08)',
          }}>
            {title}
          </div>
          {children}
        </div>
      )}

      <button onClick={() => setOpen(o => !o)} style={{
        width: 28, height: 60,
        background: '#E8924A', border: 0,
        borderRadius: open ? '0' : '8px 0 0 8px',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '-4px 0 18px rgba(0,0,0,0.3)',
        transition: 'border-radius 0.15s',
      }}>
        {open
          ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="#1A1208" strokeWidth="1.6" strokeLinecap="round"/></svg>
          : <svg width="14" height="11" viewBox="0 0 14 11" fill="none"><path d="M1 1.5h12M1 5.5h12M1 9.5h12" stroke="#1A1208" strokeWidth="1.5" strokeLinecap="round"/></svg>
        }
      </button>
    </div>
  );
}

function TweakSection({ label }) {
  return (
    <div style={{
      fontFamily: 'DM Sans,system-ui,sans-serif',
      fontSize: 9, fontWeight: 600,
      letterSpacing: '0.13em', textTransform: 'uppercase',
      color: 'rgba(232,146,74,0.6)',
      marginTop: 8,
    }}>
      {label}
    </div>
  );
}

function TweakToggle({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'rgba(250,246,240,0.78)', flex: 1 }}>{label}</span>
      <div onClick={() => onChange(!value)} style={{
        width: 36, height: 20, borderRadius: 10, flexShrink: 0,
        background: value ? '#E8924A' : 'rgba(250,246,240,0.14)',
        cursor: 'pointer', position: 'relative', transition: 'background 0.18s',
      }}>
        <div style={{
          position: 'absolute', top: 2,
          left: value ? 18 : 2,
          width: 16, height: 16, borderRadius: '50%',
          background: '#FAF6F0',
          transition: 'left 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
    </div>
  );
}

function TweakSlider({ label, value, min, max, step = 1, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'rgba(250,246,240,0.78)' }}>{label}</span>
        <span style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: '#E8924A', fontWeight: 600 }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: '100%', accentColor: '#E8924A', cursor: 'pointer', height: 4 }}
      />
    </div>
  );
}

function TweakRadio({ label, value, options, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'rgba(250,246,240,0.55)' }}>{label}</span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {options.map(opt => (
          <button key={opt.value} onClick={() => onChange(opt.value)} style={{
            padding: '4px 10px', borderRadius: 20,
            border: '0.5px solid rgba(250,246,240,0.18)',
            background: value === opt.value ? '#E8924A' : 'rgba(250,246,240,0.07)',
            color: value === opt.value ? '#1A1208' : 'rgba(250,246,240,0.65)',
            fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 11,
            cursor: 'pointer', fontWeight: value === opt.value ? 600 : 400,
          }}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TweakSelect({ label, value, options, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'rgba(250,246,240,0.55)' }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        background: 'rgba(250,246,240,0.08)',
        border: '0.5px solid rgba(250,246,240,0.18)',
        borderRadius: 8, padding: '5px 8px',
        fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12,
        color: 'rgba(250,246,240,0.88)', cursor: 'pointer', outline: 'none',
      }}>
        {options.map(opt => (
          <option key={opt.value} value={opt.value} style={{ background: '#1C1208' }}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

Object.assign(window, { useTweaks, TweaksPanel, TweakSection, TweakToggle, TweakSlider, TweakRadio, TweakSelect });
