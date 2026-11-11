/**
 * Desfile: three executive vehicles on a belt. They ride right-to-left;
 * hovering over one slows the parade, lifts that car and brightens it.
 * The read-out names the type. The slider is the parade rate.
 *
 * The pattern: dilate time. Ambient motion on a spring rate; hit test in
 * screen space against each car's current centre (so a moving car stays
 * pickable); one bright mark at rest on the car nearest the middle.
 */
const {
  Cam, circ, facing, fit, hull, open, poly, prism, proj, reducedMotion,
  ringAt, rings, rrect, run, spring, stepS, disposer, mk, pointer, put,
  reflect, register, solid,
} = HL;

const KINDS = ["suv", "sedan", "van"];
const SPACE = 60, TRACK = SPACE * KINDS.length, RY = 50, RW = 26;
const BODY = {
  suv:   { L: 36, W: 15.5, H: 9,  cL: 19, cW: 13, cH: 7.2, cOx: 6,   wh: 4 },
  sedan: { L: 40, W: 14,   H: 6.5,cL: 16, cW: 11.5,cH: 5.4, cOx: 10,  wh: 3.5 },
  van:   { L: 34, W: 15.5, H: 11, cL: 25, cW: 14, cH: 8.5, cOx: 2.5, wh: 3.8 },
};

/** Cabin: narrower top, front edge pulled back so the windscreen leans. */
function cabin(P, front, x, y, b) {
  const z0 = b.wh * 0.55 + b.H, z1 = z0 + b.cH;
  const cy = y + (b.W - b.cW) / 2, x0 = x + b.cOx;
  const foot = rrect(x0, cy, x0 + b.cL, cy + b.cW, 1.5, 5);
  const top = rrect(x0 + 3.4, cy + 0.85, x0 + b.cL - 0.8, cy + b.cW - 0.85, 1.1, 5);
  const inn = rrect(x0 + 4, cy + 1.3, x0 + b.cL - 1.3, cy + b.cW - 1.3, 0.85, 5);
  return {
    sil: poly(hull(ringAt(P, foot, z0).concat(ringAt(P, top, z1)))),
    crease: open(ringAt(P, run(inn, front), z1)),
  };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let rateVal = value;
  const C = Cam(45, 0.5, 1.7);
  fit(C, [[-6, RY - 5, 0], [TRACK + 6, RY + RW + 5, 0], [TRACK, RY, 24], [0, RY + RW, 24]], 200, 168);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);
  const [rr, ri] = rings(-12, RY - 5, TRACK + 12, RY + RW + 5, 7, 1.5);
  reflect(svg, g, P, front, rr, 0, 9);
  put(solid(g), prism(P, front, rr, ri, -2, 0));

  const cars = KINDS.map((kind, i) => {
    const grp = mk("g", {}, g);
    return { kind, i, ox: i * SPACE + 4, body: solid(grp), cab: solid(grp),
      wheels: [0, 1, 2, 3].map(() => solid(grp)), grp };
  });

  const rate = spring(rateVal, { k: 90, c: 18 });
  let phase = 22, over = -1, restHi = 0;

  const pose = (ox) => { let x = ((ox - phase) % TRACK + TRACK) % TRACK; return x > TRACK - 10 ? x - TRACK : x; };

  function drawCar(car, x) {
    const b = BODY[car.kind], y = RY + (RW - b.W) / 2, lift = over === car.i ? 5.5 : 0;
    const [br, bi] = rings(x, y, x + b.L, y + b.W, 2.1, 0.8);
    put(car.body, prism(P, front, br, bi, b.wh * 0.55 + lift, b.wh * 0.55 + b.H + lift));
    const cab = cabin(P, front, x, y, { ...b, wh: b.wh + lift * 1.8 });
    put(car.cab, cab);
    [[6, 1], [b.L - 6, 1], [6, b.W - 1], [b.L - 6, b.W - 1]].forEach(([dx, dy], k) => {
      const wx = x + dx, wy = y + dy;
      const ring = circ(b.wh * 0.82, 10).map((q) => ({ u: wx + q.u, v: wy + q.v, nu: q.nu, nv: q.nv }));
      const inn = circ(b.wh * 0.5, 10).map((q) => ({ u: wx + q.u, v: wy + q.v, nu: q.nu, nv: q.nv }));
      put(car.wheels[k], prism(P, front, ring, inn, lift, b.wh * 1.1 + lift));
    });
  }

  function setHi(a) {
    cars.forEach((c, i) => {
      const on = a < 0 ? i === restHi : i === a;
      c.body.sil.classList.toggle("hi", on);
      c.cab.sil.classList.toggle("hi", on);
    });
  }

  function hit([sx, sy]) {
    let best = -1, bd = 42;
    cars.forEach((c, i) => {
      const b = BODY[c.kind], x = pose(c.ox);
      const pt = P(x + b.L / 2, RY + RW / 2, b.wh + b.H + 4);
      const d = Math.hypot(sx - pt[0], sy - pt[1]);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  const B = register(stage, (dt) => {
    const moving = stepS(rate, dt);
    if (!reducedMotion()) phase = (phase + rate.x * dt + TRACK) % TRACK;
    restHi = cars.reduce((a, c, i) => {
      const mid = (k) => pose(cars[k].ox) + BODY[cars[k].kind].L / 2;
      return Math.abs(mid(i) - TRACK / 2) < Math.abs(mid(a) - TRACK / 2) ? i : a;
    }, 0);
    cars.map((c) => ({ c, x: pose(c.ox) })).sort((a, b) => a.x - b.x).forEach((r) => g.appendChild(r.c.grp));
    cars.forEach((c) => drawCar(c, pose(c.ox)));
    if (over < 0) setHi(-1);
    return moving || (!reducedMotion() && Math.abs(rate.x) > 0.02);
  });
  bag.add(B.unregister);

  function choose(a) {
    if (a === over) return;
    over = a;
    rate.t = a < 0 ? rateVal : rateVal * 0.08;
    read.textContent = a < 0 ? "rest" : cars[a].kind;
    setHi(a);
    B.wake();
  }

  bag.add(pointer(stage, { move: (p) => choose(hit(p)), leave: () => choose(-1) }));
  bag.add(() => svg.replaceChildren());
  setHi(-1);
  read.textContent = "rest";

  return {
    set: (v) => { rateVal = v; rate.t = over < 0 ? v : v * 0.08; B.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "desfile",
  means: "Three fleet cars on a belt: hover slows the parade and names the type under the pointer.",
  rules: [1, 4, 5, 7],
  range: [0.2, 0.65, 1.5],
  tour: [[145, 170], [205, 150], [270, 160], null],
  mount,
});
