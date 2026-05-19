// FOODSbyme — discovery screens: HomeScreen, CookProfileScreen, ItemDetailScreen.

/* ─── HomeScreen ──────────────────────────────────────────────────── */
function HomeScreen({ onOpenCook, current, onNav, onboarding, mode, onMode, onSpin, onHealth, onSearch }) {
  const containerRef = React.useRef(null);

  return (
    <div className="fbm" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Scrollable body */}
      <div ref={containerRef} className="fbm-scroll" style={{ flex: 1, overflowY: 'auto', paddingBottom: 96 }}>

        {/* Header */}
        <div style={{ padding: '62px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Wordmark size="compact" />
            <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--body-soft)', marginTop: 2 }}>
              {CUSTOMER.area}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={onSearch} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-cook)', border: '0.5px solid var(--border-warm)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--body)' }}>
              <Icon name="search" size={17} />
            </button>
            <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-cook)', border: '0.5px solid var(--border-warm)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--body)', position: 'relative' }}>
              <Icon name="bell" size={17} />
              <span style={{ position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: '50%', background: 'var(--spice)', border: '1.5px solid var(--bg)' }} />
            </button>
          </div>
        </div>

        {/* Greeting */}
        <div style={{ padding: '16px 20px 0' }}>
          <div className="t-h1" style={{ fontSize: 24, lineHeight: 1.15 }}>
            Good afternoon, <span style={{ color: 'var(--spice)' }}>{CUSTOMER.firstName}</span>.
          </div>
          <div className="t-body" style={{ marginTop: 4, color: 'var(--body-soft)' }}>
            {mode === 'planning' ? 'Browse ahead. Reserve what you want.' : 'Real kitchens, cooking near you now.'}
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ padding: '14px 20px 0' }}>
          <ModeToggle mode={mode} onChange={onMode} />
        </div>

        {/* FOODS Picks — horizontal scroll */}
        <div style={{ marginTop: 24 }}>
          <SectionHeader caps="Editors' pick" title="FOODS picks" />
          <div className="fbm-scroll" style={{ display: 'flex', gap: 12, paddingLeft: 20, paddingRight: 20, overflowX: 'auto' }}>
            {FOODS_PICKS.map((pick, i) => {
              const cook = COOKS.find(c => c.id === pick.cookId);
              return (
                <button key={i} onClick={() => cook && onOpenCook(cook)}
                  style={{
                    flexShrink: 0, width: 248, borderRadius: 18, overflow: 'hidden',
                    border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
                    background: pick.tint, position: 'relative',
                  }}>
                  <div style={{ padding: '20px 18px 18px', background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 60%)', minHeight: 130, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 20%, rgba(255,236,200,0.22), transparent 55%)' }} />
                    <div className="t-caps" style={{ color: 'rgba(255,247,232,0.65)', marginBottom: 8, fontSize: 9 }}>{pick.category}</div>
                    <div className="serif" style={{ fontSize: 16, color: 'rgba(255,247,232,0.96)', lineHeight: 1.25, letterSpacing: '-0.005em' }}>{pick.headline}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Spin for meals CTA */}
        <div style={{ margin: '20px 20px 0' }}>
          <button onClick={onSpin} style={{
            width: '100%', padding: '16px 20px', borderRadius: 16,
            background: 'var(--ink)', color: 'var(--canvas)',
            border: 'none', cursor: 'pointer', textAlign: 'left',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div className="t-label" style={{ color: 'var(--canvas)', fontSize: 15 }}>Not sure what to eat?</div>
              <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'rgba(250,246,240,0.6)', marginTop: 3 }}>Spin and let a cook decide for you</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>🎲</span>
              <Icon name="arrow-right" size={16} color="var(--ember)" />
            </div>
          </button>
        </div>

        {/* Health Kitchen banner */}
        <div style={{ margin: '12px 20px 0' }}>
          <button onClick={onHealth} style={{
            width: '100%', padding: '14px 18px', borderRadius: 16,
            background: 'var(--health-bg)', border: '0.5px solid rgba(46,139,63,0.2)',
            cursor: 'pointer', textAlign: 'left',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(46,139,63,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="leaf" size={18} color="var(--health-fg)" />
              </div>
              <div>
                <div className="t-label" style={{ color: 'var(--health-fg)', fontSize: 13 }}>Health Kitchen</div>
                <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 11, color: 'rgba(42,102,64,0.7)', marginTop: 2 }}>Cooks co-signed by nutritionists</div>
              </div>
            </div>
            <Icon name="arrow-right" size={14} color="var(--health-fg)" />
          </button>
        </div>

        {/* Cook list */}
        <div style={{ marginTop: 24 }}>
          <SectionHeader
            caps={mode === 'planning' ? 'Planning ahead' : 'Cooking near you'}
            title={mode === 'planning' ? 'Reserve a table' : 'Cooks open now'}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px' }}>
            {COOKS.map((cook, i) => (
              <CookCard key={cook.id} cook={cook} index={i} onOpen={onOpenCook} />
            ))}
          </div>
        </div>

        {/* Bottom padding */}
        <div style={{ height: 16 }} />
      </div>

      {/* Bottom nav */}
      <BottomNav current={current} onChange={onNav} onSpin={onSpin} />

      {/* Onboarding overlay */}
      {onboarding && <OnboardingOverlay />}
    </div>
  );
}

function OnboardingOverlay() {
  const [step, setStep] = React.useState(0);
  const [gone, setGone] = React.useState(false);
  if (gone) return null;

  const steps = [
    { icon: '🍲', title: 'Real cooks, real kitchens', body: 'Every meal on FOODSbyme is cooked by a real person in their kitchen — not a restaurant.' },
    { icon: '📍', title: 'Nearby and available now', body: "You see what's cooking near you today. If it says 4 slots, only 4 people will eat it." },
    { icon: '✅', title: 'Verified and safe', body: 'Every cook is NIN-verified. Look for the NAFDAC badge for food safety certification.' },
  ];

  const s = steps[step];
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,18,8,0.75)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
      <div className="card fade-up" style={{ margin: '0 16px 24px', padding: '28px 24px', width: 'calc(100% - 32px)', borderRadius: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>{s.icon}</div>
        <div className="t-h2" style={{ marginBottom: 8 }}>{s.title}</div>
        <div className="t-body" style={{ marginBottom: 24 }}>{s.body}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ height: 4, borderRadius: 2, flex: i === step ? 2 : 1, background: i === step ? 'var(--spice)' : 'var(--border-warm)', transition: 'flex 0.3s' }} />
          ))}
        </div>
        <button onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : setGone(true)}
          className="btn btn-primary btn-full" style={{ marginTop: 20, borderRadius: 14 }}>
          {step < steps.length - 1 ? 'Next' : 'Get started'}
        </button>
      </div>
    </div>
  );
}

/* ─── CookProfileScreen ───────────────────────────────────────────── */
function CookProfileScreen({ cook, onBack, onOpenItem }) {
  const [tab, setTab] = React.useState('today');
  const dish = cook.todayDish;

  return (
    <div className="fbm" style={{ position: 'absolute', inset: 0 }}>
      <div className="fbm-scroll" style={{ height: '100%', overflowY: 'auto', paddingBottom: 32 }}>

        {/* Hero area */}
        <div style={{ position: 'relative', paddingTop: 52 }}>
          <DishPhoto dish={dish} height={260} radius={0} />
          <div style={{ position: 'absolute', top: 60, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <BackPill onClick={onBack} label="" />
            <button style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(250,246,240,0.88)', backdropFilter: 'blur(12px)', border: '0.5px solid rgba(26,18,8,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-ink)' }}>
              <Icon name="share" size={17} />
            </button>
          </div>
        </div>

        {/* Cook identity card */}
        <div style={{ padding: '0 20px', marginTop: -24, position: 'relative', zIndex: 2 }}>
          <div className="card" style={{ padding: '16px 16px 14px' }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <Avatar cook={cook} size={54} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-h2" style={{ lineHeight: 1.1 }}>{cook.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                  <StatusDot status={cook.status} />
                  <span style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: cook.status === 'cooking-now' ? 'var(--leaf)' : 'var(--body-soft)' }}>
                    {cook.statusLabel}
                  </span>
                </div>
                <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--body-soft)', marginTop: 3 }}>
                  {cook.area} · {cook.distance} · {cook.cookingSince}
                </div>
              </div>
              <button style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 40, background: 'var(--ink)', color: 'var(--canvas)', border: 'none', fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                Follow
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 0, marginTop: 16, paddingTop: 14, borderTop: '0.5px solid var(--border-warm)' }}>
              {[
                { n: cook.repeatRate + '%', label: 'come back' },
                { n: cook.avgRating, label: 'rating' },
                { n: cook.totalOrders, label: 'orders' },
                { n: cook.followers >= 1000 ? (cook.followers/1000).toFixed(1)+'k' : cook.followers, label: 'followers' },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', borderRight: i < 3 ? '0.5px solid var(--border-warm)' : 'none' }}>
                  <div className="serif" style={{ fontSize: 18, color: 'var(--spice)', lineHeight: 1 }}>{s.n}</div>
                  <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 10, color: 'var(--body-soft)', marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Credentials */}
        {cook.credentials?.length > 0 && (
          <div style={{ padding: '12px 20px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cook.credentials.map(c => <CredentialPill key={c} label={c} />)}
            {cook.activeDiscount && <DiscountPill discount={cook.activeDiscount} />}
          </div>
        )}

        {/* Bio */}
        {cook.bio && (
          <div style={{ padding: '16px 20px 0' }}>
            <div className="t-body" style={{ fontStyle: 'italic', color: 'var(--body)', lineHeight: 1.6, borderLeft: '2px solid var(--ember)', paddingLeft: 12 }}>
              "{cook.bio}"
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div style={{ padding: '20px 20px 0', display: 'flex', gap: 0, borderBottom: '0.5px solid var(--border-warm)', marginTop: 4 }}>
          {[{ k:'today', label: "Today's table" }, { k:'menu', label:'Full menu' }, { k:'talk', label:'Chop talk' }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} style={{
              flex: 1, padding: '10px 6px', background: 'transparent', border: 'none',
              borderBottom: tab === t.k ? '2px solid var(--spice)' : '2px solid transparent',
              color: tab === t.k ? 'var(--spice)' : 'var(--body-soft)',
              fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Tab: Today */}
        {tab === 'today' && (
          <div style={{ padding: '16px 20px 0' }}>
            <div className="card" style={{ padding: '16px 16px' }}>
              <DishPhoto dish={dish} height={180} radius={10} />
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div className="t-h2" style={{ fontSize: 18, lineHeight: 1.2 }}>{dish.title}</div>
                  <div className="t-body" style={{ marginTop: 6 }}>{dish.description}</div>
                </div>
                <div className="serif t-price" style={{ fontSize: 22, marginLeft: 12, flexShrink: 0 }}>{nairaFmt(dish.price)}</div>
              </div>
              {dish.cookNote && (
                <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--honey)', fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, fontStyle: 'italic', color: '#5C3B16', lineHeight: 1.5 }}>
                  <Icon name="quote" size={12} color="#5C3B16" /> {dish.cookNote}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <SlotsPill left={dish.slotsLeft} total={dish.totalSlots} />
              </div>
              <button onClick={() => onOpenItem(dish)} className="btn btn-primary btn-full" style={{ marginTop: 14, borderRadius: 14 }}>
                Claim your portion <Icon name="arrow-right" size={15} />
              </button>
            </div>

            {/* Weekly schedule */}
            {cook.weekly && (
              <div style={{ marginTop: 20 }}>
                <div className="t-caps" style={{ marginBottom: 10, color: 'var(--spice)' }}>This week</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {cook.weekly.map(d => (
                    <div key={d.day} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 9, color: 'var(--caps)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>{d.day}</div>
                      <div style={{ width: '100%', paddingBottom: '100%', borderRadius: 8, background: d.rest ? 'transparent' : d.items > 0 ? 'var(--spice)' : 'var(--border-warm)', position: 'relative', border: d.rest ? '0.5px dashed var(--border-warm)' : 'none' }}>
                        {!d.rest && d.items > 0 && (
                          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 11, fontWeight: 600, color: '#FAF6F0' }}>{d.items}</span>
                        )}
                      </div>
                      <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 9, color: 'var(--body-soft)', marginTop: 4 }}>{d.date}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Menu */}
        {tab === 'menu' && (
          <div style={{ padding: '0 20px' }}>
            {(cook.menu || [cook.todayDish]).map((item, i) => (
              <React.Fragment key={item.id}>
                <MenuRow item={item} onOpen={() => onOpenItem(item)} onClaim={() => onOpenItem(item)} />
                {i < (cook.menu || []).length - 1 && <div style={{ height: 0.5, background: 'var(--border-warm)' }} />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Tab: Chop talk */}
        {tab === 'talk' && (
          <div style={{ padding: '16px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {CHOP_TALK.map((post, i) => (
              <div key={i} className="card" style={{ padding: '14px 14px 12px' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: post.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="serif" style={{ fontSize: 14, color: '#FAF6F0' }}>{post.initial}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span className="t-label" style={{ fontSize: 13 }}>{post.name}</span>
                      <span className="t-small">{post.when}</span>
                    </div>
                    <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 11, color: 'var(--body-soft)', marginTop: 2 }}>
                      {post.orders} orders{post.milestone ? ' 🎉' : ''}
                    </div>
                    <div className="t-body" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>{post.body}</div>
                    {post.cookReplied && (
                      <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--honey)', fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: '#5C3B16', fontStyle: 'italic' }}>
                        <span style={{ fontWeight: 600 }}>{cook.name}</span> replied · {post.replies} {post.replies === 1 ? 'reply' : 'replies'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Reviews */}
            {cook.reviews?.length > 0 && (
              <>
                <div className="t-caps" style={{ color: 'var(--spice)', paddingTop: 8 }}>Customer reviews</div>
                {cook.reviews.map((r, i) => (
                  <div key={i} className="card" style={{ padding: '14px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <span className="t-label" style={{ fontSize: 13 }}>{r.name}</span>
                        {r.verified && <span style={{ marginLeft: 6, fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 10, color: 'var(--success-fg)' }}>✓ verified</span>}
                        <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 11, color: 'var(--body-soft)', marginTop: 2 }}>{r.n} orders</div>
                      </div>
                      <StarRow rating={r.rating} />
                    </div>
                    <div className="t-body" style={{ fontSize: 13, lineHeight: 1.5, fontStyle: 'italic' }}>"{r.body}"</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

/* ─── ItemDetailScreen ────────────────────────────────────────────── */
function ItemDetailScreen({ cook, dish, onBack, onClaim }) {
  const [qty, setQty] = React.useState(1);
  const [selectedSides, setSelectedSides] = React.useState(
    (dish.sides || []).filter(s => s.included).map(s => s.name)
  );
  const toggleSide = (name) => setSelectedSides(ss => ss.includes(name) ? ss.filter(x => x !== name) : [...ss, name]);

  return (
    <div className="fbm" style={{ position: 'absolute', inset: 0 }}>
      <div className="fbm-scroll" style={{ height: '100%', overflowY: 'auto', paddingBottom: 120 }}>

        {/* Photo hero */}
        <div style={{ position: 'relative' }}>
          <DishPhoto dish={dish} height={280} radius={0} />
          <div style={{ position: 'absolute', top: 60, left: 16 }}>
            <BackPill onClick={onBack} label="" />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '20px 20px 0' }}>

          {/* Cook link */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Avatar cook={cook} size={28} />
            <span style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--body-soft)' }}>
              From {cook.name} · {cook.area}
            </span>
            <StatusDot status={cook.status} />
          </div>

          {/* Title + price */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div className="t-h1" style={{ fontSize: 22, lineHeight: 1.2, flex: 1 }}>{dish.title}</div>
            <div className="serif t-price" style={{ fontSize: 24, flexShrink: 0 }}>{nairaFmt(dish.price)}</div>
          </div>

          {/* Slots + status */}
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <SlotsPill left={dish.slotsLeft} total={dish.totalSlots} />
            {cook.credentials?.slice(0, 2).map(c => <CredentialPill key={c} label={c} />)}
          </div>

          {/* Description */}
          <div className="t-body" style={{ marginTop: 16, lineHeight: 1.65 }}>{dish.description}</div>

          {/* Cook note */}
          {dish.cookNote && (
            <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: 'var(--honey)', fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, fontStyle: 'italic', color: '#5C3B16', lineHeight: 1.55 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <Avatar cook={cook} size={22} />
                <div>
                  <span style={{ fontWeight: 600 }}>{cook.name}</span> says:
                  <div style={{ marginTop: 4 }}>{dish.cookNote}</div>
                </div>
              </div>
            </div>
          )}

          {/* Allergens */}
          {dish.allergens?.length > 0 && (
            <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: 'var(--warn-bg)', border: '0.5px solid rgba(179,106,46,0.2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="alert" size={16} color="var(--warn-fg)" />
              <div>
                <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--warn-fg)' }}>Contains allergens</div>
                <div style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 12, color: 'var(--warn-fg)', opacity: 0.8, marginTop: 2 }}>{dish.allergens.join(', ')}</div>
              </div>
            </div>
          )}

          {/* Sides */}
          {dish.sides?.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div className="t-label" style={{ marginBottom: 10 }}>Comes with</div>
              {dish.sides.map(s => (
                <div key={s.name} onClick={() => s.optional && toggleSide(s.name)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '0.5px solid var(--border-warm)', cursor: s.optional ? 'pointer' : 'default' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, border: '1.5px solid var(--border-warm)', background: selectedSides.includes(s.name) ? 'var(--spice)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {selectedSides.includes(s.name) && <Icon name="check" size={12} color="#FAF6F0" />}
                  </div>
                  <span style={{ fontFamily: 'DM Sans,system-ui,sans-serif', fontSize: 13, color: 'var(--body)', flex: 1 }}>{s.name}</span>
                  {!s.optional && <span className="pill pill-cream" style={{ fontSize: 10 }}>included</span>}
                  {s.optional && !s.included && <span className="t-small">optional</span>}
                </div>
              ))}
            </div>
          )}

          {/* Qty */}
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="t-label">Portions</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-cook)', border: '0.5px solid var(--border-warm)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="minus" size={16} />
              </button>
              <span className="serif" style={{ fontSize: 22, color: 'var(--spice)', minWidth: 20, textAlign: 'center' }}>{qty}</span>
              <button onClick={() => setQty(q => Math.min(dish.slotsLeft || 10, q + 1))} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--ink)', border: 0, color: 'var(--canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 20px 32px', background: 'linear-gradient(to top, var(--bg) 60%, transparent)', zIndex: 10 }}>
        <button onClick={() => onClaim(dish)} className="btn btn-primary btn-full" style={{ borderRadius: 16, padding: '16px 20px', fontSize: 15, justifyContent: 'space-between' }}>
          <span>Claim {qty > 1 ? `${qty} portions` : 'your portion'}</span>
          <span className="serif" style={{ fontSize: 18 }}>{nairaFmt(dish.price * qty)}</span>
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { HomeScreen, CookProfileScreen, ItemDetailScreen });
