// FOODSbyme — order screens: CheckoutScreen, ConfirmationScreen, TrackingScreen.

/* ─── CheckoutScreen ──────────────────────────────────────────────── */
function CheckoutScreen({ cook, dish, onBack, onPay, allergenMatch = [] }) {
  const [window, setWindow] = React.useState(DELIVERY_WINDOWS[1].id);
  const [qty, setQty] = React.useState(1);
  const total = dish.price * qty;

  const selectedWindow = DELIVERY_WINDOWS.find(w => w.id === window) || DELIVERY_WINDOWS[1];

  return (
    <div className="fbm" style={{ position: 'absolute', inset: 0 }}>
      <div className="fbm-scroll" style={{ height: '100%', overflowY: 'auto', paddingBottom: 120 }}>

        {/* Header */}
        <AppHeader
          left={<button onClick={onBack} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-ink)', display: 'flex', alignItems: 'center' }}><Icon name="chevron-left" size={22} /></button>}
          center={<div className="t-h3" style={{ fontSize: 16 }}>Claim your portion</div>}
        />

        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Dish summary */}
          <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
            <DishThumb tint={dish.tint || dish.photoTint} label={dish.photoLabel || dish.title.split(',')[0]} size={60} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-h3" style={{ fontSize: 15, lineHeight: 1.2 }}>{dish.title}</div>
              <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--body-soft)', marginTop: 4 }}>
                From {cook.name} · {cook.area}
              </div>
            </div>
            <div className="serif t-price" style={{ fontSize: 18, flexShrink: 0 }}>{nairaFmt(dish.price)}</div>
          </div>

          {/* Allergen warning */}
          {allergenMatch.length > 0 && (
            <div style={{ padding: '12px 14px', borderRadius: 14, background: 'var(--error-bg)', border: '0.5px solid rgba(192,57,43,0.2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="alert" size={16} color="var(--error-fg)" />
              <div>
                <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--error-fg)' }}>Allergen match</div>
                <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--error-fg)', opacity: 0.85, marginTop: 2 }}>
                  This dish contains {allergenMatch.join(', ')}, which is in your profile.
                </div>
              </div>
            </div>
          )}

          {/* Qty */}
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="t-label">Portions</div>
                <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--body-soft)', marginTop: 2 }}>{dish.slotsLeft} available</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-cook)', border: '0.5px solid var(--border-warm)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon name="minus" size={16} />
                </button>
                <span className="serif" style={{ fontSize: 22, color: 'var(--spice)', minWidth: 20, textAlign: 'center' }}>{qty}</span>
                <button onClick={() => setQty(q => Math.min(dish.slotsLeft, q + 1))} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--ink)', border: 0, color: 'var(--canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon name="plus" size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Delivery window */}
          <div>
            <div className="t-label" style={{ marginBottom: 10, padding: '0 2px' }}>Delivery window</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {DELIVERY_WINDOWS.map(w => (
                <button key={w.id} onClick={() => setWindow(w.id)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', borderRadius: 14,
                  background: window === w.id ? 'var(--ink)' : 'var(--bg-card)',
                  border: `0.5px solid ${window === w.id ? 'transparent' : 'var(--border-warm)'}`,
                  cursor: 'pointer', textAlign: 'left',
                  boxShadow: window === w.id ? 'none' : 'var(--shadow-card)',
                }}>
                  <div>
                    <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 14, fontWeight: 500, color: window === w.id ? 'var(--canvas)' : 'var(--text-ink)' }}>{w.label}</div>
                    <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 11, color: window === w.id ? 'rgba(250,246,240,0.6)' : 'var(--body-soft)', marginTop: 2 }}>{w.sub}</div>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${window === w.id ? 'var(--ember)' : 'var(--border-warm)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: window === w.id ? 'var(--ember)' : 'transparent' }}>
                    {window === w.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink)' }} />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Delivery address */}
          <div>
            <div className="t-label" style={{ marginBottom: 10, padding: '0 2px' }}>Delivering to</div>
            <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-cook)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="location" size={18} color="var(--spice)" />
              </div>
              <div style={{ flex: 1 }}>
                <div className="t-label" style={{ fontSize: 13 }}>Home</div>
                <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--body-soft)', marginTop: 2 }}>{CUSTOMER.address}</div>
              </div>
              <button style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--spice)', fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, fontWeight: 500 }}>Change</button>
            </div>
          </div>

          {/* Order summary */}
          <div className="card" style={{ padding: '16px 16px' }}>
            <div className="t-label" style={{ marginBottom: 12 }}>Order summary</div>
            {[
              { label: `${dish.title.split(',')[0]} × ${qty}`, value: nairaFmt(dish.price * qty) },
              { label: 'Delivery fee', value: 'Free' },
              { label: 'Service fee', value: nairaFmt(150) },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 13, color: 'var(--body)' }}>{row.label}</span>
                <span style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 13, color: 'var(--text-ink)', fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}
            <div style={{ borderTop: '0.5px solid var(--border-warm)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span className="t-label">Total</span>
              <span className="serif t-price" style={{ fontSize: 22 }}>{nairaFmt(total + 150)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pay button */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 20px 32px', background: 'linear-gradient(to top, var(--bg) 60%, transparent)', zIndex: 10 }}>
        <button onClick={() => onPay({ window, total: total + 150 })} className="btn btn-primary btn-full" style={{ borderRadius: 16, padding: '16px 20px', fontSize: 15, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="lock" size={15} color="rgba(250,246,240,0.7)" />
            Pay with Flutterwave
          </div>
          <span className="serif" style={{ fontSize: 18 }}>{nairaFmt(total + 150)}</span>
        </button>
        <div style={{ textAlign: 'center', marginTop: 10, fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 11, color: 'var(--body-soft)' }}>
          Your slot is held for 3 minutes
        </div>
      </div>
    </div>
  );
}

/* ─── ConfirmationScreen ──────────────────────────────────────────── */
function ConfirmationScreen({ cook, dish, orderRef, windowLabel, onTrack, onHome }) {
  return (
    <div className="fbm" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>

      {/* Animated check */}
      <div style={{ marginBottom: 28, position: 'relative' }}>
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="36" stroke="var(--success-fg)" strokeWidth="2.5" strokeDasharray="226" strokeDashoffset="226" style={{ animation: 'draw-circle 0.6s ease-out 0.1s forwards' }} />
          <path d="M25 40 L35 50 L55 30" stroke="var(--success-fg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="44" strokeDashoffset="44" style={{ animation: 'draw-tick 0.4s ease-out 0.7s forwards' }} />
        </svg>
      </div>

      {/* Heading */}
      <div className="t-h1 fade-up" style={{ textAlign: 'center', lineHeight: 1.2, marginBottom: 8 }}>
        You're at<br />the table.
      </div>
      <div className="t-body fade-up" style={{ textAlign: 'center', color: 'var(--body-soft)', animationDelay: '80ms', marginBottom: 28 }}>
        {cook.name} has your order. {P(cook, 'cap')} starts cooking soon.
      </div>

      {/* Order card */}
      <div className="card fade-up" style={{ padding: '16px 16px', width: '100%', animationDelay: '140ms', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <DishThumb tint={dish.tint || dish.photoTint} label={dish.photoLabel || dish.title.split(',')[0]} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-h3" style={{ fontSize: 14, lineHeight: 1.2 }}>{dish.title}</div>
            <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--body-soft)', marginTop: 4 }}>From {cook.name}</div>
          </div>
        </div>

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '0.5px solid var(--border-warm)' }}>
          {[
            { label: 'Order reference', value: orderRef },
            { label: 'Delivery window', value: windowLabel },
            { label: 'Delivering to', value: 'Home · ' + CUSTOMER.area },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--body-soft)' }}>{row.label}</span>
              <span style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, fontWeight: 500, color: 'var(--text-ink)' }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button onClick={onTrack} className="btn btn-primary btn-full" style={{ borderRadius: 14, padding: '15px 20px' }}>
          <Icon name="location" size={16} />
          Track your order
        </button>
        <button onClick={onHome} className="btn btn-ghost btn-full" style={{ borderRadius: 14, padding: '13px 20px', color: 'var(--body-soft)' }}>
          Back to home
        </button>
      </div>
    </div>
  );
}

/* ─── TrackingScreen ──────────────────────────────────────────────── */
function TrackingScreen({ cook, dish, orderRef, status, statusOverride = 0, onBack }) {
  const currentIdx = statusOverride;

  return (
    <div className="fbm" style={{ position: 'absolute', inset: 0 }}>
      <div className="fbm-scroll" style={{ height: '100%', overflowY: 'auto', paddingBottom: 32 }}>

        {/* Header */}
        <AppHeader
          left={<button onClick={onBack} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-ink)', display: 'flex', alignItems: 'center' }}><Icon name="chevron-left" size={22} /></button>}
          center={<div className="t-h3" style={{ fontSize: 16 }}>Your order</div>}
          right={<div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 11, color: 'var(--spice)', fontWeight: 600 }}>{orderRef}</div>}
        />

        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Map placeholder */}
          <div style={{ borderRadius: 18, overflow: 'hidden', height: 180, background: 'var(--bg-cook)', border: '0.5px solid var(--border-warm)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent 0 39px, var(--border-warm) 39px 40px), repeating-linear-gradient(90deg, transparent 0 39px, var(--border-warm) 39px 40px)', opacity: 0.4 }} />
            <div style={{ position: 'relative', textAlign: 'center' }}>
              <div style={{ fontSize: 32 }}>🗺️</div>
              <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--body-soft)', marginTop: 8 }}>
                {currentIdx >= 4 ? 'Rider is on the way' : currentIdx >= 2 ? `Cooking at ${cook.area}` : `Waiting at ${cook.area}`}
              </div>
            </div>
          </div>

          {/* Status headline */}
          <div className="card" style={{ padding: '18px 18px', display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: currentIdx >= 6 ? 'var(--success-bg)' : 'var(--honey)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 22 }}>
                {currentIdx >= 6 ? '🎉' : currentIdx >= 4 ? '🛵' : currentIdx >= 2 ? '🍲' : '⏳'}
              </span>
            </div>
            <div>
              <div className="t-h3" style={{ fontSize: 16 }}>{ORDER_STEPS[currentIdx]?.label || 'Processing'}</div>
              <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--body-soft)', marginTop: 3 }}>
                {ORDER_STEPS[currentIdx]?.time}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="card" style={{ padding: '16px 16px' }}>
            <div className="t-label" style={{ marginBottom: 14 }}>Order timeline</div>
            {ORDER_STEPS.map((step, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              const future = i > currentIdx;
              return (
                <div key={step.key} style={{ display: 'flex', gap: 14, marginBottom: i < ORDER_STEPS.length - 1 ? 0 : 0 }}>
                  {/* Line + dot */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      background: done ? 'var(--success-fg)' : active ? 'var(--spice)' : 'var(--border-warm)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: active ? '0 0 0 4px rgba(179,106,46,0.15)' : 'none',
                      transition: 'all 0.3s',
                    }}>
                      {done && <Icon name="check" size={10} color="#FAF6F0" />}
                      {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FAF6F0' }} />}
                    </div>
                    {i < ORDER_STEPS.length - 1 && (
                      <div style={{ width: 2, height: 32, background: done ? 'var(--success-fg)' : 'var(--border-warm)', opacity: done ? 0.6 : 0.5, marginTop: 2, transition: 'background 0.3s' }} />
                    )}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: i < ORDER_STEPS.length - 1 ? 12 : 0 }}>
                    <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 13, fontWeight: active ? 600 : 400, color: future ? 'var(--body-soft)' : 'var(--text-ink)', lineHeight: 1.3 }}>{step.label}</div>
                    {(done || active) && <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 11, color: 'var(--body-soft)', marginTop: 2 }}>{step.time}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cook card */}
          <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <Avatar cook={cook} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-h3" style={{ fontSize: 15 }}>{cook.name}</div>
              <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--body-soft)', marginTop: 2 }}>{cook.area} · {cook.distance}</div>
            </div>
            <button style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-cook)', border: '0.5px solid var(--border-warm)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="chat" size={18} color="var(--spice)" />
            </button>
          </div>

          {/* Dish summary */}
          <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
            <DishThumb tint={dish.tint || dish.photoTint} label={dish.photoLabel || dish.title.split(',')[0]} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-h3" style={{ fontSize: 14, lineHeight: 1.2 }}>{dish.title}</div>
              <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--body-soft)', marginTop: 4 }}>{nairaFmt(dish.price)}</div>
            </div>
          </div>

        </div>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

Object.assign(window, { CheckoutScreen, ConfirmationScreen, TrackingScreen });
