// FOODSbyme — shared components.

function Wordmark({ size = 'compact', on = 'light' }) {
  const sizes = {
    compact: { foods: 22, byme: 11, gap: 3 },
    medium:  { foods: 34, byme: 16, gap: 4 },
    hero:    { foods: 54, byme: 24, gap: 6 },
  }[size] || { foods: 22, byme: 11, gap: 3 };

  let foodsColor, bymeColor;
  if (on === 'dark') { foodsColor = 'var(--canvas)'; bymeColor = 'var(--ember)'; }
  else if (on === 'spice') { foodsColor = 'var(--canvas)'; bymeColor = 'rgba(250,246,240,0.75)'; }
  else { foodsColor = 'var(--ink)'; bymeColor = 'var(--spice)'; }

  return (
    <span className="wordmark" style={{ whiteSpace: 'nowrap', lineHeight: 1 }}>
      <span className="serif" style={{ fontSize: sizes.foods, color: foodsColor, letterSpacing: '-0.005em', verticalAlign: 'baseline' }}>FOODS</span>
      <span className="sans" style={{ fontSize: sizes.byme, color: bymeColor, fontWeight: 300, marginLeft: sizes.gap, verticalAlign: 'baseline' }}>byme</span>
    </span>
  );
}

function AppHeader({ left, right, center, bgTint }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '62px 16px 12px', minHeight: 108, position: 'relative',
      background: bgTint || 'transparent', zIndex: 5,
    }}>
      <div style={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>{left}</div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>{center || <Wordmark size="compact" />}</div>
      <div style={{ width: 36, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{right}</div>
    </div>
  );
}

function HeaderIcon({ children, onClick, dot }) {
  return (
    <button onClick={onClick} style={{
      width: 36, height: 36, borderRadius: '50%', background: 'transparent',
      border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-ink)', position: 'relative', cursor: 'pointer',
    }}>
      {children}
      {dot && <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--spice)', border: '1.5px solid var(--bg)' }} />}
    </button>
  );
}

function BackPill({ onClick, label }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px 8px 10px',
      borderRadius: 40, background: 'rgba(250,246,240,0.88)', backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)', border: '0.5px solid rgba(26,18,8,0.08)',
      color: 'var(--text-ink)', cursor: 'pointer', fontFamily: 'DM Sans, system-ui, sans-serif',
      fontSize: 13, fontWeight: 500,
    }}>
      <Icon name="chevron-left" size={16} />{label}
    </button>
  );
}

function Avatar({ cook, size = 44 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: cook.avatarBg || 'var(--ember)', color: 'var(--canvas)',
      fontFamily: 'DM Serif Display, Georgia, serif', fontSize: size * 0.42, lineHeight: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, position: 'relative', overflow: 'hidden',
    }}>
      <span style={{ transform: 'translateY(1px)' }}>{cook.initial}</span>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.18), transparent 55%)', pointerEvents: 'none' }} />
    </div>
  );
}

function StatusDot({ status, withRing = false }) {
  const color = { 'cooking-now': '#2E8B3F', 'prepping': '#E8924A', 'done': '#B8A88A' }[status] || '#B8A88A';
  const pulse = status === 'cooking-now';
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10 }}>
      {pulse && <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', background: color, opacity: 0.2, animation: 'pulse-dot 2s ease-in-out infinite' }} />}
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: withRing ? '0 0 0 2px var(--bg)' : 'none', zIndex: 1 }} />
    </span>
  );
}

function DishPhoto({ dish, height = 200, label, radius = 14 }) {
  const tint = dish.tint || dish.photoTint || '#C97A35';
  return (
    <div style={{ width: '100%', height, borderRadius: radius, overflow: 'hidden', position: 'relative', background: tint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 25% 20%, rgba(255,236,200,0.32), transparent 55%), radial-gradient(circle at 75% 80%, rgba(0,0,0,0.18), transparent 50%)' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(110deg, transparent 0 3px, rgba(255,255,255,0.025) 3px 4px)' }} />
      <div style={{ position: 'relative', textAlign: 'center', padding: 16 }}>
        <div style={{ fontFamily: 'DM Serif Display, Georgia, serif', fontStyle: 'italic', color: 'rgba(255,247,232,0.88)', fontSize: height > 220 ? 32 : height > 160 ? 22 : 16, lineHeight: 1.1, letterSpacing: '-0.005em' }}>{label || dish.photoLabel || dish.title}</div>
      </div>
      <div style={{ position: 'absolute', bottom: 10, right: 12, fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 9, fontWeight: 500, letterSpacing: '0.18em', color: 'rgba(255,247,232,0.5)', textTransform: 'uppercase' }}>plate · placeholder</div>
    </div>
  );
}

function DishThumb({ tint, label, size = 72, radius = 10 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', position: 'relative', background: tint, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 25%, rgba(255,236,200,0.32), transparent 55%)' }} />
      <span style={{ fontFamily: 'DM Serif Display, Georgia, serif', fontStyle: 'italic', color: 'rgba(255,247,232,0.9)', fontSize: 11, padding: '0 6px', textAlign: 'center', lineHeight: 1.1 }}>{label}</span>
    </div>
  );
}

function CredentialPill({ label }) {
  const styles = {
    'NAFDAC':              { bg: 'var(--info-bg)',    fg: 'var(--info-fg)' },
    'Trained chef':        { bg: 'var(--cream)',      fg: 'var(--text-ink)' },
    'NIN verified':        { bg: 'var(--success-bg)', fg: 'var(--success-fg)' },
    'NAFDAC in progress':  { bg: 'var(--warn-bg)',    fg: 'var(--warn-fg)' },
    'Health Kitchen':      { bg: 'var(--health-bg)',  fg: 'var(--health-fg)' },
    'Nutritionist':        { bg: 'var(--health-bg)',  fg: 'var(--health-fg)' },
  }[label] || { bg: 'var(--cream)', fg: 'var(--text-ink)' };
  return (
    <span className="pill" style={{ background: styles.bg, color: styles.fg, border: label === 'Trained chef' ? '0.5px solid var(--border-warm)' : 'none' }}>
      {label === 'Health Kitchen' && <Icon name="leaf" size={11} />}
      {label === 'NAFDAC' && <Icon name="badge-check" size={11} />}
      {label === 'NIN verified' && <Icon name="check" size={11} />}
      {label}
    </span>
  );
}

function SlotsPill({ left, total, compact = false }) {
  const veryFew = left <= 2;
  return (
    <span className="pill" style={{ background: veryFew ? '#FAECE7' : 'var(--honey)', color: veryFew ? 'var(--error-fg)' : '#5C3B16', fontWeight: 500 }}>
      {left === 0 ? "She's cooked for today" : left === 1 ? '1 portion left' : veryFew ? `Only ${left} left` : compact ? `${left} left` : `${left} of ${total} left`}
    </span>
  );
}

function SectionHeader({ caps, title, action, onAction }) {
  return (
    <div style={{ padding: '0 20px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        {caps && <div className="t-caps" style={{ marginBottom: 6, color: 'var(--spice)', whiteSpace: 'nowrap' }}>{caps}</div>}
        <div className="t-h2">{title}</div>
      </div>
      {action && (
        <button onClick={onAction} style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 13, fontWeight: 500, color: 'var(--spice)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {action} <Icon name="arrow-right" size={14} />
        </button>
      )}
    </div>
  );
}

function ModeToggle({ mode, onChange }) {
  const eating = mode !== 'planning';
  return (
    <div style={{ display: 'inline-flex', padding: 4, borderRadius: 40, background: 'var(--bg-cook)', border: '0.5px solid var(--border-warm)', width: '100%' }}>
      {[{ k: 'eating', label: 'Eating today' }, { k: 'planning', label: 'Planning ahead' }].map(opt => {
        const active = (opt.k === 'eating') === eating;
        return (
          <button key={opt.k} onClick={() => onChange(opt.k)} style={{ flex: 1, padding: '10px 14px', borderRadius: 40, border: 0, cursor: 'pointer', background: active ? 'var(--ink)' : 'transparent', color: active ? 'var(--canvas)' : 'var(--body-soft)', fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 13, fontWeight: 500, transition: 'all 0.15s ease' }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function DiscountPill({ discount }) {
  if (!discount) return null;
  return (
    <span className="pill" style={{ background: '#FAECE7', color: 'var(--spice)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <Icon name="tip" size={11} /> {discount.label}
    </span>
  );
}

function BottomNav({ current, onChange, onSpin }) {
  const items = [
    { key: 'home', icon: 'home', label: 'Home' },
    { key: 'discover', icon: 'compass', label: 'Discover' },
    { key: 'spin', icon: 'dice', label: 'Spin', special: true },
    { key: 'orders', icon: 'note', label: 'Orders' },
    { key: 'account', icon: 'user', label: 'You' },
  ];
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30, paddingBottom: 28, paddingTop: 8, background: 'linear-gradient(to top, var(--bg) 60%, transparent)' }}>
      <div style={{ margin: '0 12px', padding: '8px 6px', background: 'var(--bg-card)', borderRadius: 28, border: '0.5px solid var(--border-warm)', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {items.map(it => {
          const active = current === it.key;
          if (it.special) {
            return (
              <button key={it.key} onClick={() => onSpin?.() || onChange(it.key)} style={{ background: 'var(--ink)', border: 0, cursor: 'pointer', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ember)', flexShrink: 0, boxShadow: '0 4px 14px rgba(26,18,8,0.25)' }}>
                <Icon name={it.icon} size={22} />
              </button>
            );
          }
          return (
            <button key={it.key} onClick={() => onChange(it.key)} style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: '8px 4px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: active ? 'var(--spice)' : 'var(--body-soft)', borderRadius: 16 }}>
              <Icon name={it.icon} size={20} fill={active ? 'currentColor' : 'none'} />
              <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: '0.02em' }}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CookCard({ cook, index = 0, onOpen }) {
  const dish = cook.todayDish;
  const followers = cook.followers ? (cook.followers >= 1000 ? (cook.followers / 1000).toFixed(1) + 'k' : cook.followers) : null;
  return (
    <button onClick={() => onOpen?.(cook)} className="card fade-up" style={{ animationDelay: `${index * 60}ms`, width: '100%', textAlign: 'left', padding: 0, cursor: 'pointer', overflow: 'hidden', display: 'block', background: 'var(--bg-card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px' }}>
        <Avatar cook={cook} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t-h3" style={{ fontSize: 16, lineHeight: 1.2, whiteSpace: 'nowrap', display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span>{cook.name}</span>
            {followers && <><span style={{ color: 'var(--caps)', fontSize: 12 }}>·</span><span className="sans" style={{ fontSize: 11, fontWeight: 400, color: 'var(--body-soft)' }}>{followers} followers</span></>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', fontFamily: 'DM Sans, system-ui, sans-serif' }}>
            <StatusDot status={cook.status} />
            <span style={{ color: cook.status === 'cooking-now' ? 'var(--leaf)' : 'var(--body-soft)', flexShrink: 0 }}>{cook.status === 'cooking-now' && cook.closesAt ? cook.closesAt : cook.statusLabel}</span>
            <span style={{ color: 'var(--caps)' }}>·</span>
            <span style={{ color: 'var(--body-soft)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cook.area} · {cook.distance}</span>
          </div>
        </div>
        {cook.healthKitchen && <div style={{ flexShrink: 0 }}><CredentialPill label="Health Kitchen" /></div>}
      </div>
      <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="serif" style={{ fontSize: 26, color: 'var(--spice)', lineHeight: 1, letterSpacing: '-0.01em' }}>{cook.repeatRate}%</span>
        <span style={{ fontSize: 12, color: 'var(--body)', lineHeight: 1.2 }}>come back</span>
        <span style={{ color: 'var(--caps)', margin: '0 2px' }}>·</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'var(--body)' }}><Icon name="star" size={11} fill="var(--spice)" color="var(--spice)" /> {cook.avgRating}</span>
        <span style={{ fontSize: 11, color: 'var(--body-soft)' }}>· {cook.totalOrders}</span>
      </div>
      <div style={{ padding: '0 16px' }}><DishPhoto dish={dish} height={172} radius={12} /></div>
      <div style={{ padding: '14px 16px 6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="t-h3" style={{ lineHeight: 1.2 }}>{dish.title}</div>
            {dish.description && <div className="t-small" style={{ marginTop: 4, fontSize: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{dish.description}</div>}
          </div>
          <div className="serif" style={{ fontSize: 19, color: 'var(--spice)', whiteSpace: 'nowrap' }}>{nairaFmt(dish.price)}</div>
        </div>
      </div>
      <div style={{ padding: '10px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {cook.activeDiscount && <DiscountPill discount={cook.activeDiscount} />}
          <SlotsPill left={dish.slotsLeft} total={dish.totalSlots} compact />
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 40, background: 'var(--ink)', color: 'var(--canvas)', fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
          Join the table <Icon name="arrow-right" size={14} />
        </div>
      </div>
    </button>
  );
}

function MenuRow({ item, onClaim, onOpen }) {
  return (
    <div onClick={() => onOpen?.(item)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', cursor: onOpen ? 'pointer' : 'default' }}>
      <DishThumb tint={item.tint} label={item.title.split(',')[0]} size={72} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="serif" style={{ fontSize: 14, color: 'var(--text-ink)', lineHeight: 1.2 }}>{item.title}</div>
        {item.note && <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--body-soft)', marginTop: 4 }}>{item.note}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <span className="serif" style={{ fontSize: 15, color: 'var(--spice)' }}>{nairaFmt(item.price)}</span>
          <SlotsPill left={item.slotsLeft} total={item.totalSlots || 10} compact />
        </div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onClaim?.(item); }} className="btn-icon" style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--ink)', color: 'var(--canvas)', border: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Icon name="plus" size={18} />
      </button>
    </div>
  );
}

function StarRow({ rating, size = 12 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2, color: 'var(--spice)' }}>
      {[1,2,3,4,5].map(n => <Icon key={n} name="star" size={size} fill={n <= rating ? 'var(--spice)' : 'none'} />)}
    </span>
  );
}

Object.assign(window, { Wordmark, AppHeader, HeaderIcon, BackPill, Avatar, StatusDot, DishPhoto, DishThumb, CredentialPill, SlotsPill, SectionHeader, BottomNav, CookCard, MenuRow, StarRow, ModeToggle, DiscountPill });
