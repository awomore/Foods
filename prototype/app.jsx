// FOODSbyme — App router + state.
// One linear flow: Home → Cook → Item → Checkout → Confirmation → Tracking.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "cookId": "dami",
  "orderStep": 3,
  "slotsState": "regular",
  "onboarding": false,
  "primaryAccent": "#B36A2E",
  "mode": "eating",
  "showTray": true
}/*EDITMODE-END*/;

const SCREENS = {
  HOME: 'home',
  COOK: 'cook',
  ITEM: 'item',
  CHECKOUT: 'checkout',
  CONFIRM: 'confirm',
  TRACK: 'track',
  SPIN: 'spin',
  TRAY: 'tray',
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [screen, setScreen] = React.useState(SCREENS.HOME);
  const [history, setHistory] = React.useState([]);
  const [bottomTab, setBottomTab] = React.useState('home');

  const [activeCook, setActiveCook] = React.useState(COOKS[0]);
  const [activeDish, setActiveDish] = React.useState(null);
  const [orderRef, setOrderRef] = React.useState('FBM-78421');
  const [windowLabel, setWindowLabel] = React.useState('2pm – 3pm');

  const [tray, setTray] = React.useState(TRAY_SEED);
  const trayTotal = tray.reduce((s, it) => s + it.price * it.qty, 0);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.dark ? 'dark' : 'light');
  }, [t.dark]);

  const adjustedCook = React.useMemo(() => {
    const c = COOKS.find(c => c.id === t.cookId) || COOKS[0];
    const slotsMap = { 'plenty': 8, 'regular': c.todayDish.slotsLeft, 'few': 2, 'sold-out': 0 };
    return {
      ...c,
      todayDish: { ...c.todayDish, slotsLeft: slotsMap[t.slotsState] ?? c.todayDish.slotsLeft },
    };
  }, [t.cookId, t.slotsState]);

  React.useEffect(() => {
    if (screen === SCREENS.COOK) setActiveCook(adjustedCook);
  }, [adjustedCook, screen]);

  const goto = (next, data = {}) => {
    setHistory(h => [...h, screen]);
    if (data.cook) setActiveCook(data.cook);
    if (data.dish) setActiveDish(data.dish);
    setScreen(next);
  };
  const back = () => {
    setHistory(h => {
      const last = h[h.length - 1] || SCREENS.HOME;
      setScreen(last);
      return h.slice(0, -1);
    });
  };
  const home = () => {
    setHistory([]);
    setScreen(SCREENS.HOME);
    setBottomTab('home');
  };

  const openCookFromCard = (cook) => {
    const merged = cook.id === adjustedCook.id ? adjustedCook : cook;
    goto(SCREENS.COOK, { cook: merged });
  };
  const openItem = (dish) => goto(SCREENS.ITEM, { dish });
  const claimItem = (dish) => {
    setActiveDish(dish || activeDish);
    goto(SCREENS.CHECKOUT, dish ? { dish } : {});
  };
  const pay = ({ window, total }) => {
    const w = DELIVERY_WINDOWS.find(x => x.id === window) || DELIVERY_WINDOWS[1];
    setWindowLabel(w.label);
    setOrderRef('FBM-' + Math.floor(70000 + Math.random() * 9000));
    setHistory([]);
    setScreen(SCREENS.CONFIRM);
  };
  const trackOrder = () => goto(SCREENS.TRACK);

  const allergenMatch = React.useMemo(() => {
    if (!activeDish?.allergens) return [];
    return activeDish.allergens.filter(a => CUSTOMER.allergens.includes(a));
  }, [activeDish]);

  let body;
  if (screen === SCREENS.HOME) {
    body = <HomeScreen
      onOpenCook={openCookFromCard}
      onOpenAccount={() => setBottomTab('account')}
      current={bottomTab} onNav={setBottomTab}
      onboarding={t.onboarding}
      mode={t.mode}
      onMode={(v) => setTweak('mode', v)}
      onSpin={() => goto(SCREENS.SPIN)}
      onHealth={() => goto(SCREENS.COOK, { cook: COOKS.find(c => c.healthKitchen) })}
      onSearch={() => null}
    />;
  } else if (screen === SCREENS.SPIN) {
    body = <SpinForMealsScreen onBack={back}
      onAdd={(dish, cook) => {
        setTray(t => [...t, { cookId: cook.id, dishId: dish.id, qty: 1,
          window: 'Today 6–7pm', address: 'Home', price: dish.price }]);
      }}
      onCheckout={() => { back(); }} />;
  } else if (screen === SCREENS.COOK) {
    body = <CookProfileScreen cook={activeCook} onBack={back} onOpenItem={openItem} />;
  } else if (screen === SCREENS.ITEM) {
    body = <ItemDetailScreen cook={activeCook} dish={activeDish || activeCook.todayDish}
      onBack={back} onClaim={(d) => claimItem(d || activeDish || activeCook.todayDish)} />;
  } else if (screen === SCREENS.CHECKOUT) {
    body = <CheckoutScreen cook={activeCook} dish={activeDish || activeCook.todayDish}
      onBack={back} onPay={pay} allergenMatch={allergenMatch} />;
  } else if (screen === SCREENS.CONFIRM) {
    body = <ConfirmationScreen cook={activeCook} dish={activeDish || activeCook.todayDish}
      orderRef={orderRef} windowLabel={windowLabel} onTrack={trackOrder} onHome={home} />;
  } else if (screen === SCREENS.TRACK) {
    body = <TrackingScreen cook={activeCook} dish={activeDish || activeCook.todayDish}
      orderRef={orderRef} status={ORDER_STEPS[Math.max(0, Math.min(6, t.orderStep))].key}
      statusOverride={Math.max(0, Math.min(6, t.orderStep))}
      onBack={home} />;
  }

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0,
        background: 'radial-gradient(circle at 50% 30%, #2a1d10 0%, #110a04 70%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto',
      }}>
        <div style={{
          padding: '40px 0', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 20, minHeight: '100%',
        }}>
          <div style={{ textAlign: 'center', opacity: 0.92 }}>
            <Wordmark size="medium" on="dark" />
            <div className="t-caps" style={{ marginTop: 8, color: 'rgba(232,146,74,0.7)' }}>
              Real food · real kitchens · real people
            </div>
          </div>

          <IOSDevice width={402} height={874} dark={t.dark}>
            {body}
            {t.showTray && tray.length > 0 && screen !== SCREENS.CHECKOUT && screen !== SCREENS.CONFIRM && (
              <FloatingTray tray={tray} total={trayTotal} onCheckout={() => goto(SCREENS.CHECKOUT)} />
            )}
          </IOSDevice>

          <ScreenChips current={screen} onJump={(s) => { setHistory([]); setScreen(s); }} />
        </div>
      </div>

      <TweaksPanel title="FOODSbyme tweaks">
        <TweakSection label="Theme" />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak('dark', v)} />

        <TweakSection label="Cook persona" />
        <TweakSelect label="Open" value={t.cookId}
          options={COOKS.map(c => ({ value: c.id, label: `${c.name} · ${c.area}` }))}
          onChange={(v) => setTweak('cookId', v)} />

        <TweakSection label="Order status" />
        <TweakSlider label="Step" value={t.orderStep} min={0} max={6} step={1}
          onChange={(v) => setTweak('orderStep', v)} />
        <div className="t-caps" style={{ color: 'rgba(41,38,27,0.55)', fontSize: 9.5,
          fontFamily: 'DM Sans, system-ui, sans-serif', marginTop: -4 }}>
          {ORDER_STEPS[t.orderStep]?.label}
        </div>

        <TweakSection label="Today's dish" />
        <TweakRadio label="Slots" value={t.slotsState}
          options={[
            { value: 'plenty', label: 'Plenty' },
            { value: 'regular', label: '4 left' },
            { value: 'few', label: '2 left' },
          ]}
          onChange={(v) => setTweak('slotsState', v)} />

        <TweakSection label="Tray" />
        <TweakToggle label="Show floating tray" value={t.showTray} onChange={(v) => setTweak('showTray', v)} />

        <TweakSection label="Mode" />
        <TweakRadio label="Browsing" value={t.mode}
          options={[
            { value: 'eating', label: 'Eating today' },
            { value: 'planning', label: 'Planning ahead' },
          ]}
          onChange={(v) => setTweak('mode', v)} />
        <TweakToggle label="First-time user" value={t.onboarding} onChange={(v) => setTweak('onboarding', v)} />
      </TweaksPanel>
    </>
  );
}

function ScreenChips({ current, onJump }) {
  const stops = [
    { k: SCREENS.HOME,    n: 'Home' },
    { k: SCREENS.SPIN,    n: 'Spin' },
    { k: SCREENS.COOK,    n: 'Cook' },
    { k: SCREENS.ITEM,    n: 'Dish' },
    { k: SCREENS.CHECKOUT,n: 'Claim' },
    { k: SCREENS.CONFIRM, n: 'At the table' },
    { k: SCREENS.TRACK,   n: 'Tracking' },
  ];
  return (
    <div style={{
      display: 'flex', gap: 6, padding: '6px 8px', borderRadius: 40,
      background: 'rgba(250,246,240,0.08)', backdropFilter: 'blur(10px)',
      border: '0.5px solid rgba(250,246,240,0.12)',
    }}>
      {stops.map(s => (
        <button key={s.k} onClick={() => onJump(s.k)} style={{
          padding: '6px 12px', border: 0, borderRadius: 40, cursor: 'pointer',
          background: current === s.k ? 'rgba(232,146,74,0.92)' : 'transparent',
          color: current === s.k ? 'var(--ink)' : 'rgba(250,246,240,0.65)',
          fontFamily: 'DM Sans, system-ui, sans-serif', fontSize: 11, fontWeight: 500,
        }}>{s.n}</button>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
