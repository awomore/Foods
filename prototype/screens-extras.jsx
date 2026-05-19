// FOODSbyme — extras: FloatingTray, SpinForMealsScreen.

/* ─── FloatingTray ────────────────────────────────────────────────── */
function FloatingTray({ tray, total, onCheckout }) {
  const [open, setOpen] = React.useState(false);
  const count = tray.reduce((s, it) => s + it.qty, 0);

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 40,
      padding: '0 16px 28px',
      pointerEvents: 'none',
    }}>
      <div style={{ pointerEvents: 'all' }}>
        {/* Expanded tray */}
        {open && (
          <div className="card fade-up" style={{ padding: '16px 16px 12px', marginBottom: 10, borderRadius: 20 }}>
            <div className="t-label" style={{ marginBottom: 10 }}>Your tray</div>
            {tray.map((it, i) => {
              const cook = COOKS.find(c => c.id === it.cookId);
              const dish = cook?.menu?.find(d => d.id === it.dishId) || cook?.todayDish;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: i < tray.length - 1 ? '0.5px solid var(--border-warm)' : 'none', marginBottom: i < tray.length - 1 ? 10 : 0 }}>
                  <DishThumb tint={dish?.tint || dish?.photoTint || '#C97A35'} label={dish?.photoLabel || 'Dish'} size={40} radius={8} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 13, fontWeight: 500, color: 'var(--text-ink)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dish?.title || 'Dish'}</div>
                    <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 11, color: 'var(--body-soft)', marginTop: 2 }}>{cook?.name} · {it.window}</div>
                  </div>
                  <span className="serif" style={{ fontSize: 14, color: 'var(--spice)', flexShrink: 0 }}>{nairaFmt(it.price * it.qty)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Tray pill */}
        <button onClick={() => tray.length > 1 ? setOpen(o => !o) : onCheckout()} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderRadius: 18,
          background: 'var(--ink)',
          border: 'none', cursor: 'pointer',
          boxShadow: '0 8px 32px rgba(26,18,8,0.35)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(232,146,74,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="bag" size={16} color="var(--ember)" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--canvas)', lineHeight: 1 }}>
                {count} {count === 1 ? 'item' : 'items'} in tray
              </div>
              {tray.length > 1 && (
                <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 11, color: 'rgba(250,246,240,0.5)', marginTop: 2 }}>
                  {tray.length} cooks · {open ? 'tap to collapse' : 'tap to expand'}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="serif" style={{ fontSize: 18, color: 'var(--ember)' }}>{nairaFmt(total)}</span>
            <div style={{ padding: '8px 14px', borderRadius: 40, background: 'rgba(250,246,240,0.12)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 13, fontWeight: 500, color: 'var(--canvas)' }}>Checkout</span>
              <Icon name="arrow-right" size={13} color="var(--ember)" />
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

/* ─── SpinForMealsScreen ──────────────────────────────────────────── */
function SpinForMealsScreen({ onBack, onAdd, onCheckout }) {
  const allDishes = COOKS.flatMap(cook =>
    (cook.menu || [cook.todayDish]).map(dish => ({ dish, cook }))
  );

  const [idx, setIdx] = React.useState(() => Math.floor(Math.random() * allDishes.length));
  const [spinning, setSpinning] = React.useState(false);
  const [added, setAdded] = React.useState(false);
  const [addedCount, setAddedCount] = React.useState(0);

  const current = allDishes[idx];

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setAdded(false);
    let count = 0;
    const interval = setInterval(() => {
      setIdx(Math.floor(Math.random() * allDishes.length));
      count++;
      if (count >= 12) {
        clearInterval(interval);
        setSpinning(false);
      }
    }, 80);
  };

  const handleAdd = () => {
    if (!added) {
      onAdd(current.dish, current.cook);
      setAdded(true);
      setAddedCount(c => c + 1);
    }
  };

  return (
    <div className="fbm" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <AppHeader
        left={<button onClick={onBack} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-ink)', display: 'flex', alignItems: 'center' }}><Icon name="chevron-left" size={22} /></button>}
        center={<div className="t-h3" style={{ fontSize: 16 }}>Spin for meals</div>}
      />

      {/* Content */}
      <div style={{ flex: 1, padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>

        {/* Description */}
        <div style={{ textAlign: 'center' }}>
          <div className="t-h1" style={{ fontSize: 22, lineHeight: 1.25 }}>Not sure what to eat?</div>
          <div className="t-body" style={{ color: 'var(--body-soft)', marginTop: 6 }}>Let a cook decide for you.</div>
        </div>

        {/* Spinning card */}
        <div style={{ width: '100%', position: 'relative' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', opacity: spinning ? 0.7 : 1, transition: 'opacity 0.1s' }}>
            <DishPhoto dish={current.dish} height={220} radius={16} />
            <div style={{ padding: '16px 16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Avatar cook={current.cook} size={28} />
                <span style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--body-soft)' }}>
                  {current.cook.name} · {current.cook.area}
                </span>
                <StatusDot status={current.cook.status} />
              </div>
              <div className="t-h2" style={{ fontSize: 18, lineHeight: 1.2 }}>{current.dish.title}</div>
              <div className="t-body" style={{ marginTop: 6, fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{current.dish.description}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <SlotsPill left={current.dish.slotsLeft} total={current.dish.totalSlots || 10} compact />
                  {current.cook.activeDiscount && <DiscountPill discount={current.cook.activeDiscount} />}
                </div>
                <div className="serif t-price" style={{ fontSize: 20 }}>{nairaFmt(current.dish.price)}</div>
              </div>
            </div>
          </div>

          {/* Spinning overlay */}
          {spinning && (
            <div style={{ position: 'absolute', inset: 0, borderRadius: 16, background: 'rgba(250,246,240,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 40 }}>🎲</div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={spin} disabled={spinning} style={{
              flex: 1, padding: '14px', borderRadius: 14,
              background: 'var(--bg-cook)', border: '0.5px solid var(--border-warm)',
              cursor: spinning ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 14, fontWeight: 500, color: 'var(--body)',
              opacity: spinning ? 0.5 : 1,
            }}>
              <span style={{ fontSize: 18 }}>🎲</span>
              Spin again
            </button>
            <button onClick={handleAdd} style={{
              flex: 2, padding: '14px', borderRadius: 14,
              background: added ? 'var(--success-bg)' : 'var(--ink)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 14, fontWeight: 500,
              color: added ? 'var(--success-fg)' : 'var(--canvas)',
              transition: 'all 0.2s',
            }}>
              <Icon name={added ? 'check' : 'plus'} size={16} />
              {added ? 'Added to tray' : 'Add to tray'}
            </button>
          </div>

          {addedCount > 0 && (
            <button onClick={onCheckout} className="btn btn-primary btn-full" style={{ borderRadius: 14, padding: '14px', background: 'var(--spice)' }}>
              Checkout {addedCount} {addedCount === 1 ? 'meal' : 'meals'}
              <Icon name="arrow-right" size={15} />
            </button>
          )}
        </div>

        {/* Caption */}
        <div style={{ textAlign: 'center', fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--body-soft)', fontStyle: 'italic', marginTop: -4 }}>
          Every dish is from a real cook near you.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { FloatingTray, SpinForMealsScreen });
