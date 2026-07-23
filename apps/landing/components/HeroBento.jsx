import Image from "next/image";
import {
  ArrowRight,
  CogIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  MicIcon,
  MobileIcon,
  MonitorIcon,
  OperationsIcon,
  ShopIcon,
  TabletIcon,
  TelegramIcon,
  TicketIcon,
  WhatsappIcon,
  XIcon,
} from "./icons";

const AVATARS = [
  "from-brand-light to-brand-dark",
  "from-accent-green-light to-accent-green",
  "from-ink-soft to-ink",
];

// Weekly Sales Overview demo data (USD per day): revenue up, refunds down.
const SALES = [
  { day: "Mon", date: "12", revenue: 520, refund: 180 },
  { day: "Tue", date: "13", revenue: 780, refund: 240 },
  { day: "Wed", date: "14", revenue: 610, refund: 300 },
  { day: "Thu", date: "15", revenue: 900, refund: 220 },
  { day: "Fri", date: "16", revenue: 680, refund: 420 },
  { day: "Sat", date: "17", revenue: 430, refund: 260 },
  { day: "Sun", date: "18", revenue: 740, refund: 190 },
];

// Symmetric axis so the zero line sits in the middle of the plot.
const AXIS_MAX = 1000;
const AXIS = [1000, 500, 0, -500, -1000];
const NET_TOTAL = SALES.reduce((s, d) => s + d.revenue - d.refund, 0); // weekly net

const BAR_DARK = "#F15A29"; // revenue (above zero) — brand
const BAR_LIGHT = "#FBD3C3"; // refunds (below zero) — brand tint

const usd = (n) =>
  `${n < 0 ? "-" : "+"}$${Math.abs(n).toLocaleString("en-US")}`;

const REVENUE_TOTAL = SALES.reduce((s, d) => s + d.revenue, 0);
const REFUND_TOTAL = SALES.reduce((s, d) => s + d.refund, 0);

// Semicircular tick gauge: dark ticks (revenue) fill from the left, light
// ticks (refunds) fill the rest, proportional to their share of the total.
const rad = (deg) => (deg * Math.PI) / 180;
const GAUGE_TICKS = 40;
const GAUGE = (() => {
  const cx = 100;
  const cy = 100;
  const r = 82;
  const len = 15;
  const darkCount = Math.round(
    GAUGE_TICKS * (REVENUE_TOTAL / (REVENUE_TOTAL + REFUND_TOTAL)),
  );
  return Array.from({ length: GAUGE_TICKS }, (_, i) => {
    const a = rad(180 - (180 * i) / (GAUGE_TICKS - 1));
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return {
      x1: +(cx + (r - len) * cos).toFixed(1),
      y1: +(cy - (r - len) * sin).toFixed(1),
      x2: +(cx + r * cos).toFixed(1),
      y2: +(cy - r * sin).toFixed(1),
      dark: i < darkCount,
    };
  });
})();

export default function HeroBento() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(180px,auto)]">
        {/* ---- Promo tile ---- */}
        <div className="relative flex min-h-[260px] flex-col justify-between overflow-hidden rounded-3xl bg-ink p-6 text-left sm:col-span-2 lg:col-span-2">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/25 blur-2xl" />
          <div className="relative">
            <h3 className="text-xl font-bold text-white">
              Automation of the day
            </h3>
            <p className="mt-1 text-sm text-white/60">
              Approve your AI plan every day before 12 pm.
            </p>
          </div>
          <div className="relative flex items-center justify-between gap-4">
            <p className="max-w-[15rem] text-sm text-white/80">
              28 sellers already automated their store today!{" "}
              <span className="font-semibold text-brand">LET&apos;S GO</span>
            </p>
            <div className="flex items-center">
              <div className="flex -space-x-2.5">
                {AVATARS.map((grad, i) => (
                  <span
                    key={i}
                    className={`h-8 w-8 rounded-full bg-gradient-to-br ${grad} ring-2 ring-ink`}
                  />
                ))}
              </div>
              <span className="-ml-1.5 flex h-8 items-center rounded-full bg-brand px-2.5 text-xs font-bold text-white ring-2 ring-ink">
                +25
              </span>
            </div>
          </div>
        </div>

        {/* ---- Smart AI Call Center tile ---- */}
        <CallCenterTile className="min-h-[260px] sm:col-span-2 lg:col-span-2" />

        {/* ---- Omnichannel hub tile ---- */}
        <ChannelHub className="min-h-[200px] sm:col-span-2 lg:col-span-1 lg:row-span-2" />

        {/* ---- Sales chart card ---- */}
        <div className="flex min-h-[250px] flex-col rounded-3xl border border-line bg-white p-5 text-left sm:col-span-2 lg:col-span-2 lg:row-span-2">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-base font-bold text-ink">Sales Overview</p>
              <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-light">
                Sep 12 — Sep 17 / 24
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-ink">{usd(NET_TOTAL)}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-light">
                Net / week
              </p>
            </div>
          </div>

          {/* toggle */}
          <div className="mt-4 inline-flex self-start rounded-full bg-surface-alt p-1 text-xs font-semibold">
            <span className="rounded-full bg-[#fdf9f8] px-3 py-1 text-ink">
              Weekly
            </span>
            <span className="px-3 py-1 text-muted">Monthly</span>
          </div>

          {/* diverging bar chart: revenue up, refunds down */}
          <div className="mt-5 flex flex-1 flex-col">
            <div className="flex flex-1 gap-2.5">
              {/* y-axis */}
              <div className="flex w-7 flex-none flex-col justify-between py-1 text-right text-[9px] font-medium text-muted-light">
                {AXIS.map((v) => (
                  <span key={v}>{v > 0 ? `+${v}` : v}</span>
                ))}
              </div>

              {/* plot */}
              <div className="relative flex-1">
                {/* gridlines */}
                <div className="absolute inset-0 flex flex-col justify-between">
                  {AXIS.map((v) => (
                    <div
                      key={v}
                      className={`h-px w-full ${v === 0 ? "bg-line" : "bg-line/60"}`}
                    />
                  ))}
                </div>
                {/* bars */}
                <div className="relative flex h-full items-stretch gap-2">
                  {SALES.map((d) => (
                    <div key={d.day} className="flex flex-1 flex-col">
                      {/* positive half */}
                      <div className="flex flex-1 items-end justify-center">
                        <div
                          className="w-3 rounded-t-md"
                          style={{
                            height: `${(d.revenue / AXIS_MAX) * 100}%`,
                            backgroundColor: BAR_DARK,
                          }}
                        />
                      </div>
                      {/* negative half */}
                      <div className="flex flex-1 items-start justify-center">
                        <div
                          className="w-3 rounded-b-md"
                          style={{
                            height: `${(d.refund / AXIS_MAX) * 100}%`,
                            backgroundColor: BAR_LIGHT,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* x-axis labels */}
            <div className="mt-2 flex gap-2.5">
              <div className="w-7 flex-none" />
              <div className="flex flex-1 gap-2">
                {SALES.map((d) => (
                  <div
                    key={d.day}
                    className="flex-1 text-center text-[9px] font-medium leading-tight text-muted"
                  >
                    {d.day}
                    <br />
                    <span className="text-muted-light">{d.date}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* legend */}
          <div className="mt-3 flex items-center gap-4 border-t border-line pt-3 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: BAR_DARK }}
              />
              Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: BAR_LIGHT }}
              />
              Refunds
            </span>
          </div>
        </div>

        {/* ---- Stat cards ---- */}
        <StatCard
          icon={OperationsIcon}
          label="Orders"
          value="+1,204"
          className="min-h-[150px]"
        />
        <RevenueGauge className="min-h-[150px]" />
      </div>

      {/* ---- Feature cards ---- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ResponsiveCard />
        <InventoryCard />
        <CustomizeCard />
      </div>
    </div>
  );
}

function ResponsiveCard() {
  return (
    <div className="flex flex-col rounded-3xl border border-line bg-white p-6 relative">
      {/* store preview */}
      <Image
        src="/assets/screen.png"
        alt="Storefront preview"
        width={402}
        height={389}
        className="mx-auto h-auto w-4/5 rounded-lg"
      />
      <div class="absolute left-0 bottom-0 h-40 w-full bg-white blur-[20.95px]"></div>
      <div className="-mt-5 z-10 relative">
        <h3 className="text-lg font-bold text-ink">Perfect on every screen</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Your store looks stunning on any device — desktop, tablet, or mobile.
          Enjoy a smooth experience.
        </p>
      </div>
    </div>
  );
}

// Main product table.
const PRODUCTS = [
  {
    name: "Serum Pump",
    sub: "Skincare",
    price: "320.00",
    stock: "120 in stock",
    img: "/assets/products/serum.jpg",
  },
  {
    name: "Water Filter",
    sub: "Home & kitchen",
    price: "1,500.00",
    stock: "85 in stock",
    img: "/assets/products/water.jpg",
  },
  {
    name: "Animotronix",
    sub: "sticker for machine",
    price: "750.00",
    stock: "65 in stock",
    img: "/assets/products/sticker.jpg",
  },
  {
    name: "Elegant Women's",
    sub: "Women's Sneakers",
    price: "1,200.00",
    stock: "150 in stock",
    img: "/assets/products/sneaker.jpg",
  },
];

// Low-stock items shown in the floating "Inventory Alerts" popover.
const ALERTS = [
  { name: "Serum Pump", qty: 10, img: "/assets/products/cosmetic.jpg" },
  { name: "Sony Game", qty: 25, img: "/assets/products/game.jpg" },
  { name: "Lofree mouse", qty: 30, img: "/assets/products/mouse.jpg" },
];

function InventoryCard() {
  return (
    <div className="flex flex-col rounded-3xl border border-line bg-white p-6">
      <div className="mb-8">
        <h3 className="text-lg font-bold text-ink">
          Inventory &amp; Order Management
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Forget stock shortages or overselling. Track inventory in real time
          with a low-stock view.
        </p>
      </div>
      {/* Inventory table */}
      <div className="relative rounded-2xl border border-line bg-white mx-8 md:mx-12">
        {/* table header */}
        <div className="grid grid-cols-[1.7fr_1fr_1fr] gap-2 border-b border-line  bg-surface-alt px-4 py-3 text-[11px] font-semibold text-muted rounded-t-2xl">
          <span>Product</span>
          <span className="text-right">Selling Price</span>
          <span className="text-right">Inventory</span>
        </div>

        {/* rows */}
        <div className="divide-y divide-line">
          {PRODUCTS.map((p) => (
            <div
              key={p.name}
              className="grid grid-cols-[1.7fr_1fr_1fr] items-center gap-2 px-4 py-2"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Image
                  src={p.img}
                  alt={p.name}
                  width={40}
                  height={40}
                  className="h-8 w-8 flex-none rounded-lg object-cover"
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-ink">
                    {p.name}
                  </span>
                  <span className="block truncate text-[10px] text-muted-light">
                    {p.sub}
                  </span>
                </span>
              </span>
              <span className="text-right text-xs font-semibold text-ink">
                {p.price}
              </span>
              <span className="text-right text-xs text-muted">{p.stock}</span>
            </div>
          ))}
        </div>

        {/* floating low-stock alerts popover */}
        <div className="absolute -left-5 -top-5 w-[62%] rounded-2xl border border-line bg-white p-2.5 shadow-[0_20px_45px_-16px_rgba(20,20,20,0.28)]">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold text-ink">
              Inventory Alerts
            </span>
            <ArrowRight className="h-3 w-3 -rotate-45 text-muted-light" />
          </div>
          <div className="mt-2 space-y-0.5">
            {ALERTS.map((a) => (
              <div
                key={a.name}
                className="flex items-center gap-2 rounded-lg px-1 py-1"
              >
                <Image
                  src={a.img}
                  alt={a.name}
                  width={40}
                  height={40}
                  className="h-8 w-8 flex-none rounded-md object-cover"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-[9px] font-semibold text-[#F1556C]">
                      Low Stock
                    </span>
                    <span className="text-[9px] text-muted-light">
                      QTY: {a.qty}pcs
                    </span>
                  </span>
                  <span className="block truncate text-[11px] font-semibold text-ink text-left">
                    {a.name}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const CONFIG = [
  { Icon: ShopIcon, label: "Manage Shop" },
  {
    Icon: MonitorIcon,
    label: "Fonts & Color",
    active: true,
    texts: ["Fonts & Color", "Themes", "Layout", "Logo & Brand"],
  },
  { Icon: TicketIcon, label: "Promo Codes" },
];

function CustomizeCard() {
  return (
    <div className="flex flex-col rounded-3xl border border-line bg-white p-6">
      <div className="w-60 m-auto">
        <p className="text-[11px] font-medium text-muted text-left">
          Configuration
        </p>
        <div className="mt-3 flex flex-col gap-1.5">
          {CONFIG.map(({ Icon, label, active, texts }) => (
            <span
              key={label}
              className={`flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold ${
                active
                  ? "rounded-xl bg-white text-brand shadow-sm ring-1 ring-brand"
                  : "text-muted"
              }`}
            >
              <Icon className="h-4 w-4 flex-none" />
              {active && texts ? (
                <span className="block h-5 overflow-hidden">
                  <span className="flex flex-col animate-text-roll motion-reduce:animate-none">
                    {[...texts, texts[0]].map((t, i) => (
                      <span
                        key={i}
                        className="flex h-5 items-center whitespace-nowrap leading-5"
                      >
                        {t}
                      </span>
                    ))}
                  </span>
                </span>
              ) : (
                label
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-lg font-bold text-ink">Customize Your Store</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Choose from beautifully crafted themes and personalize every detail to
          create your store.
        </p>
      </div>
    </div>
  );
}

// Layered soundwave paths for the call-center tile. Each has its own vertical
// scale + phase so the stacked curves read as one shimmering waveform.
const WAVES = [
  { scale: 1, phase: 0, color: "#F15A29", opacity: 0.55, width: 1.4 },
  { scale: 0.7, phase: 1.1, color: "#F79C7E", opacity: 0.45, width: 1.2 },
  { scale: 0.85, phase: 2.3, color: "#7FBF9E", opacity: 0.4, width: 1.2 },
  { scale: 0.5, phase: 3.4, color: "#F15A29", opacity: 0.3, width: 1 },
  { scale: 0.65, phase: 4.6, color: "#A9CBB8", opacity: 0.3, width: 1 },
];

// Build a sine path across the 400-wide viewbox, centred on y=50. Amplitude
// eases toward the edges so the wave fades out symmetrically.
function wavePath(scale, phase) {
  const w = 400;
  const mid = 50;
  const steps = 80;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * w;
    const edge = Math.sin((i / steps) * Math.PI); // 0 → 1 → 0
    const y =
      mid - Math.sin((i / steps) * Math.PI * 6 + phase) * 30 * scale * edge;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return d.trim();
}

function CallCenterTile({ className = "" }) {
  return (
    <div
      className={`relative flex flex-col items-center overflow-hidden rounded-3xl border border-line bg-white px-6 pt-7 text-center ${className}`}
    >
      <h3 className="text-xl font-bold text-ink">Smart AI Call Center</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted">
        Never miss a customer conversation. AI answers calls instantly, resolves
        common questions, and supports your business around the clock.
      </p>

      {/* Soundwave + glowing mic */}
      <div className="pointer-events-none relative mt-auto flex w-full flex-1 items-end justify-center">
        <svg
          viewBox="0 0 400 100"
          preserveAspectRatio="none"
          className="absolute bottom-0 h-24 w-full"
          aria-hidden="true"
        >
          {WAVES.map((w, i) => (
            <path
              key={i}
              d={wavePath(w.scale, w.phase)}
              fill="none"
              stroke={w.color}
              strokeOpacity={w.opacity}
              strokeWidth={w.width}
              strokeLinecap="round"
              strokeDasharray="1.5 4"
            />
          ))}
        </svg>

        {/* Mic button with concentric glow rings */}
        <div className="relative mb-2 flex h-20 w-20 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-brand/10" />
          <span className="absolute inset-2.5 rounded-full bg-brand/20" />
          <span className="absolute inset-4.5 rounded-full bg-gradient-to-br from-brand-light to-brand-dark shadow-lg shadow-brand/40" />
          <MicIcon className="relative h-7 w-7 text-white" />
        </div>
      </div>
    </div>
  );
}

// The real channels a store connects to, collected from the mAutomate Channels
// screen. `top`/`left` place each chip on the square graphic; `d`/`node` are the
// connector trace + hub-edge dot in the same 100×100 space; `sz`/`tint` fit the
// glyph; `soon` marks a platform that isn't live yet (WhatsApp).
const CHANNELS = [
  {
    name: "Facebook",
    Icon: FacebookIcon,
    top: 15,
    left: 26,
    d: "M43 31 V15 H26",
    node: [43, 31],
    sz: "h-7 w-7",
  },
  {
    name: "Instagram",
    Icon: InstagramIcon,
    top: 15,
    left: 74,
    d: "M57 31 V15 H74",
    node: [57, 31],
    sz: "h-7 w-7",
  },
  {
    name: "WhatsApp",
    Icon: WhatsappIcon,
    top: 42,
    left: 88,
    d: "M62 42 H88",
    node: [62, 42],
    sz: "h-7 w-7",
    soon: true,
  },
  {
    name: "Telegram",
    Icon: TelegramIcon,
    top: 73,
    left: 66,
    d: "M55 54 V73 H66",
    node: [55, 54],
    sz: "h-7 w-7",
  },
  {
    name: "X (Twitter)",
    Icon: XIcon,
    top: 73,
    left: 34,
    d: "M45 54 V73 H34",
    node: [45, 54],
    sz: "h-4 w-4",
    tint: "text-ink",
  },
  {
    name: "LinkedIn",
    Icon: LinkedinIcon,
    top: 42,
    left: 12,
    d: "M38 42 H12",
    node: [38, 42],
    sz: "h-7 w-7",
  },
];

function ChannelHub({ className = "" }) {
  return (
    <div
      className={`channel-hub group relative flex flex-col overflow-hidden rounded-3xl border border-brand/10 bg-gradient-to-b from-brand-soft to-white p-6 text-left ${className}`}
    >
      {/* Channel graphic */}
      <div className="relative mx-auto aspect-square w-full max-w-75">
        {/* faint grid, fading out toward the edges */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(#f2cebc 1px, transparent 1px), linear-gradient(90deg, #f2cebc 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            WebkitMaskImage:
              "radial-gradient(circle at 50% 42%, #000 45%, transparent 78%)",
            maskImage:
              "radial-gradient(circle at 50% 42%, #000 45%, transparent 78%)",
            opacity: 0.5,
          }}
          aria-hidden="true"
        />

        {/* Connector traces */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 h-full w-full"
          fill="none"
          aria-hidden="true"
        >
          {CHANNELS.map((c, i) => (
            <g key={i}>
              <path
                d={c.d}
                stroke="#F3A585"
                strokeWidth="0.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx={c.node[0]} cy={c.node[1]} r="1.5" fill="#F15A29" />
            </g>
          ))}
        </svg>

        {/* Soft glow + store hub */}
        <span className="absolute left-1/2 top-[42%] aspect-square w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-lg" />
        <div className="absolute left-1/2 top-[42%] flex aspect-square w-[23%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-white ring-1 ring-brand/10">
          <CogIcon className="h-3/5 w-3/5" />
        </div>

        {/* Channel chips */}
        {CHANNELS.map(
          ({ name, Icon, top, left, sz = "h-6 w-6", tint = "", soon }, i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ top: `${top}%`, left: `${left}%` }}
            >
              <span
                title={soon ? `${name} — coming soon` : name}
                className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white ring-1 ring-brand/10 animate-float-chip transition-transform duration-300 ease-smooth group-hover:scale-110 motion-reduce:animate-none"
                style={{ animationDelay: `${i * 0.7}s` }}
              >
                <Icon className={`${sz} ${tint}`} />
                {soon && (
                  <span
                    className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-400"
                    aria-hidden="true"
                  />
                )}
              </span>
            </span>
          ),
        )}
      </div>

      {/* Copy */}
      <div className="relative mt-4">
        <h3 className="text-2xl font-bold text-ink">
          Every channel, one store
        </h3>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
          Publish and reply across Facebook, Instagram, WhatsApp, Telegram, X
          and LinkedIn — all from mAutomate.
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, className = "" }) {
  return (
    <div
      className={`flex flex-col justify-between rounded-3xl bg-brand-soft p-5 text-left ${className}`}
    >
      <span className="flex h-9 w-9 items-center justify-center self-end rounded-xl bg-white text-brand">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-lg font-bold text-ink">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-brand">{value}</p>
      </div>
    </div>
  );
}

function RevenueGauge({ className = "" }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-3xl bg-brand-soft p-4 text-center ${className}`}
    >
      {/* Gauge SVG */}
      <svg
        viewBox="0 0 200 108"
        className="-mx-3 w-[calc(100%+1.5rem)] max-w-none"
        aria-hidden="true"
      >
        {GAUGE.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.dark ? BAR_DARK : BAR_LIGHT}
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        ))}
      </svg>

      <p className="-mt-5 text-xl font-bold text-ink">{usd(REVENUE_TOTAL)}</p>
      <p className="mt-0.5 text-xs text-muted">in sales this week.</p>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: BAR_DARK }}
          />
          Revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: BAR_LIGHT }}
          />
          Refunds
        </span>
      </div>
    </div>
  );
}
