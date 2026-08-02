// Vertical landing pages — one focused solution page per audience. Each object
// is intentionally written to be meaningfully DIFFERENT from the others:
// distinct workflow, distinct pain points, distinct feature framing. Near-
// duplicate/templated copy is an E-E-A-T liability, so every field is written
// for its specific audience rather than filled from a template.
//
// Consumed by app/solutions/[vertical]/page.jsx (generateStaticParams +
// generateMetadata) and app/solutions/page.jsx (index).

export const VERTICALS = [
  {
    slug: "coaches",
    audience: "Coaches",
    title: "AI Store Builder for Coaches",
    h1: "Sell coaching programs with a store that runs itself",
    intro:
      "mAutomate builds and runs an online store for coaches: describe your programs and the AI creates your sales pages, packages sessions and courses, takes payment, books discovery calls, and answers prospects day and night. You keep coaching while the AI handles the storefront, marketing, and follow-up.",
    painPoints: [
      "You spend more hours building funnels and editing pages than you do coaching clients.",
      "Discovery-call leads go cold because nobody replies the moment they show interest.",
      "Program pricing, tiers, and payment plans are scattered across Calendly, Stripe, and a page builder that never quite matches.",
      "Your email nurture and social posts are the first thing that slips the week you get busy with clients.",
    ],
    benefits: [
      {
        title: "Program pages written for you",
        body: "Tell the AI what you coach and who it's for. It drafts long-form sales pages, session packages, and payment-plan tiers with copy tuned to convert browsers into booked calls.",
      },
      {
        title: "Instant lead capture and replies",
        body: "AI support answers prospects on chat and email in your voice the moment they land, qualifies them, and points serious leads straight to your booking or checkout.",
      },
      {
        title: "Nurture that never lapses",
        body: "The marketing suite writes and schedules your emails and social posts so your list stays warm during launch season and the weeks you're fully booked.",
      },
      {
        title: "Your own coaching domain",
        body: "Launch on a custom domain that matches your brand, so your programs live on yourname.com instead of a rented profile you don't control.",
      },
    ],
    faq: [
      {
        q: "Can I sell one-to-one sessions and group programs from the same store?",
        a: "Yes. The AI sets up individual sessions, multi-session packages, and group cohorts as separate products, each with its own price, payment plan, and checkout, so clients pick the format that fits.",
      },
      {
        q: "Does it handle booking and payment together?",
        a: "It does. Clients pay at checkout and are routed to book their call or session immediately after, so you never chase payment or manually reconcile a calendar link with an invoice.",
      },
      {
        q: "I'm not a copywriter. Will the sales pages sound like me?",
        a: "The AI drafts your pages from a short brief about your method and clients, then you edit tone and detail in a conversation. It writes in your voice and you approve everything before it goes live.",
      },
      {
        q: "How long until my coaching store is live?",
        a: "Most coaches have a working storefront the same day. You start free for 14 days, build and test your programs, and your plan only begins when the trial ends.",
      },
    ],
    metaTitle: "AI Store Builder for Coaches | mAutomate",
    metaDescription:
      "Sell coaching programs, sessions, and courses from an AI-run store. mAutomate builds your sales pages, captures leads, books calls, and markets for you.",
  },
  {
    slug: "artists",
    audience: "Artists",
    title: "AI Store Builder for Artists",
    h1: "Sell your art online without becoming your own webmaster",
    intro:
      "mAutomate is an AI-run store for artists who would rather make work than manage a website. Upload your pieces and the AI builds a gallery-style shop, writes each artwork's description, prices originals and prints, ships collectors their orders, and answers commission enquiries so your studio time stays yours.",
    painPoints: [
      "Website tools treat paintings like generic products, and the layouts never do your work justice.",
      "Writing a title, story, and dimensions for every single piece eats the hours you'd rather spend creating.",
      "Commission enquiries and print-size questions pile up in your inbox while you're mid-project.",
      "Marketing feels like self-promotion you never signed up for, so new drops go unseen.",
    ],
    benefits: [
      {
        title: "A gallery that flatters the work",
        body: "The AI builds an image-first storefront designed around your art, with large uncluttered layouts, collection pages by series, and product pages that put the piece before the sales pitch.",
      },
      {
        title: "Descriptions and pricing, drafted",
        body: "Upload an image and the AI writes the title, story, and materials, and suggests pricing for originals, limited editions, and open prints, so listing a new piece takes minutes.",
      },
      {
        title: "Enquiries answered while you paint",
        body: "AI support fields commission requests, sizing and framing questions, and shipping timelines around the clock, escalating only the conversations that genuinely need you.",
      },
      {
        title: "Drops that market themselves",
        body: "When you add a new series, the marketing suite announces it across email and social with imagery pulled from your shop, so collectors hear about the work without you writing the posts.",
      },
    ],
    faq: [
      {
        q: "Can I sell original one-of-a-kind pieces and prints of the same work?",
        a: "Yes. The AI creates the original as a single-quantity product and sets up prints as separate variants by size and edition, each with its own price and stock, from one artwork upload.",
      },
      {
        q: "Will my shop look like a template or like my art?",
        a: "It's built around your images. The AI chooses gallery-style layouts that keep the focus on the work, and you can restyle colours, type, and spacing in a conversation until it feels like your studio.",
      },
      {
        q: "How does it handle commission requests?",
        a: "AI support collects the brief, budget, and timeline from the collector, answers common questions, and hands you a ready-to-review enquiry so you only step in when a commission is real.",
      },
      {
        q: "Do I need my own domain to look professional?",
        a: "You can connect a custom domain so collectors buy from your own address rather than a marketplace profile. It's included, and the AI walks you through connecting it.",
      },
    ],
    metaTitle: "AI Store Builder for Artists | mAutomate",
    metaDescription:
      "Sell originals and prints from a gallery-style AI store. mAutomate writes your artwork descriptions, prices editions, ships orders, and markets new drops.",
  },
  {
    slug: "print-on-demand-sellers",
    audience: "Print-on-demand sellers",
    title: "AI Store Builder for Print-on-Demand Sellers",
    h1: "Run a print-on-demand store without the daily grind",
    intro:
      "mAutomate runs a print-on-demand store for you: the AI builds your storefront, writes SEO product listings for hundreds of designs, generates realistic mockups, keeps variants and pricing straight, and handles customer questions about sizing and shipping, so you can scale your catalog without drowning in listing work.",
    painPoints: [
      "Every new design means writing another title, description, and tags, then multiplying it across sizes and colours.",
      "Generic listing copy buries your products, so nothing ranks and paid traffic is the only way to sell.",
      "\"Where's my order?\" and sizing questions flood your inbox because fulfillment is handled by a third party.",
      "You have hundreds of designs ready but no time to turn them into listings that actually convert.",
    ],
    benefits: [
      {
        title: "Bulk listings that rank",
        body: "Point the AI at a design and it writes keyword-aware titles, descriptions, and tags for every product, so your catalog is built for search instead of copy-pasted placeholder text.",
      },
      {
        title: "Variants and mockups handled",
        body: "The AI sets up every size, colour, and style as clean variants with matched pricing and generates lifestyle mockups, turning one design into a complete, shoppable listing in minutes.",
      },
      {
        title: "Shipping and sizing questions, answered",
        body: "AI support fields the constant flow of order-status, size-chart, and returns questions in your brand voice, so print-on-demand's biggest support drain runs itself.",
      },
      {
        title: "SEO and social on autopilot",
        body: "The marketing suite optimises product pages and posts your best sellers to social with generated mockups, driving free traffic instead of relying only on ads.",
      },
    ],
    faq: [
      {
        q: "Can it create listings for hundreds of designs quickly?",
        a: "Yes. The AI generates titles, descriptions, tags, and variant structures at scale, so a large design library becomes a full catalog of search-ready listings without you writing each one.",
      },
      {
        q: "Does it connect to my print provider?",
        a: "mAutomate runs your storefront, catalog, marketing, and support. You keep fulfillment with your print partner, and the AI manages everything customers see and every question they ask.",
      },
      {
        q: "Will the product descriptions be unique or duplicated?",
        a: "Each listing is written fresh for its design and audience with distinct copy and keywords, which is what search engines reward, rather than the duplicate text that gets print-on-demand stores buried.",
      },
      {
        q: "How does it reduce my support load?",
        a: "Most print-on-demand tickets are order status, sizing, and returns. AI support answers those instantly around the clock in your voice and only escalates the cases that need a human.",
      },
    ],
    metaTitle: "AI Store Builder for Print-on-Demand Sellers | mAutomate",
    metaDescription:
      "Scale a print-on-demand store with AI: bulk SEO listings, auto-generated mockups, clean variants, and 24/7 support for sizing and shipping questions.",
  },
  {
    slug: "digital-product-creators",
    audience: "Digital product creators",
    title: "AI Store Builder for Digital Product Creators",
    h1: "Sell digital products with instant delivery and zero admin",
    intro:
      "mAutomate builds an AI-run store for digital product creators. Upload your templates, ebooks, presets, or courses and the AI writes the sales pages, sets up secure instant delivery, handles licensing and refunds, and answers pre-sale questions, so your files sell and deliver themselves while you make the next product.",
    painPoints: [
      "Stitching together checkout, file delivery, and license keys across three tools always breaks at the worst moment.",
      "Sales pages for downloads need to overcome doubt fast, and writing that copy is its own full-time skill.",
      "Pre-purchase questions about formats, licensing, and compatibility go unanswered and cost you the sale.",
      "Every refund and re-download request interrupts you, even though it's the same handful of issues each time.",
    ],
    benefits: [
      {
        title: "Sales pages built to convert downloads",
        body: "The AI writes benefit-led pages with what's-included lists, format details, and FAQs that answer buyer doubt up front, the specifics that turn a curious visitor into a purchase.",
      },
      {
        title: "Secure instant delivery",
        body: "Files are delivered automatically the moment payment clears, with protected download links, so customers get their product instantly and you never send an attachment by hand.",
      },
      {
        title: "Pre-sale questions answered",
        body: "AI support handles format, licensing, and compatibility questions the instant they're asked, capturing sales that would otherwise vanish while you're offline.",
      },
      {
        title: "Launches that run themselves",
        body: "New drop? The marketing suite writes the launch emails and social posts and schedules them, so each product release reaches your audience without a manual campaign.",
      },
    ],
    faq: [
      {
        q: "How are files delivered to customers?",
        a: "Automatically and instantly. As soon as payment clears, the buyer receives a secure download link, so delivery happens without you lifting a finger, day or night.",
      },
      {
        q: "Can I sell templates, ebooks, presets, and courses from one store?",
        a: "Yes. Each is set up as its own product type with the right delivery, from a single download to full course access, all sold and delivered from the same AI-run storefront.",
      },
      {
        q: "What about licensing and personal-versus-commercial use?",
        a: "You define your license terms, the AI presents them clearly on the product page, and AI support answers buyer questions about usage rights before they purchase.",
      },
      {
        q: "Do customers get their own login to re-download?",
        a: "Yes. Buyers can access their purchases from a customer account, so re-download requests stop landing in your inbox and are handled by the store itself.",
      },
    ],
    metaTitle: "AI Store Builder for Digital Product Creators | mAutomate",
    metaDescription:
      "Sell templates, ebooks, presets, and courses from an AI-run store with secure instant delivery, converting sales pages, and 24/7 pre-sale support.",
  },
  {
    slug: "handmade-makers",
    audience: "Handmade makers",
    title: "AI Store Builder for Handmade Makers",
    h1: "Sell your handmade goods from your own store, not a marketplace",
    intro:
      "mAutomate gives handmade makers an AI-run store off the marketplace treadmill. The AI builds your shop, writes each product's story, tracks small-batch stock, manages made-to-order timelines, and answers customer questions, so you keep your margins and your brand instead of renting a stall and paying fees on every sale.",
    painPoints: [
      "Marketplace fees eat your margin on every order, and the platform owns your customer relationship, not you.",
      "Describing the materials and process behind each handmade item, again and again, takes time away from making.",
      "Small batches and made-to-order pieces make stock and lead times hard to keep accurate.",
      "Buyers message constantly about custom orders, materials, and turnaround, and every reply pulls you off the workbench.",
    ],
    benefits: [
      {
        title: "Your brand, not a marketplace stall",
        body: "The AI builds a storefront on your own custom domain, so customers buy from your brand and you keep the full margin instead of handing a cut to a marketplace on every sale.",
      },
      {
        title: "Product stories written for you",
        body: "Photograph a piece and the AI drafts its description, materials, care instructions, and the maker's story, so listing new work honours the craft without eating your studio hours.",
      },
      {
        title: "Small-batch and made-to-order handled",
        body: "Track limited quantities, mark items made-to-order with clear lead times, and let the store set buyer expectations automatically, so you never oversell a one-of-a-kind piece.",
      },
      {
        title: "Custom-order questions answered",
        body: "AI support handles the steady stream of material, sizing, and turnaround questions in your voice and passes real custom-order requests to you ready to quote.",
      },
    ],
    faq: [
      {
        q: "Why sell on my own store instead of a marketplace?",
        a: "You keep the full margin, own the customer relationship, and build a brand on your own domain, rather than paying per-sale fees and competing on a crowded marketplace that owns your buyers.",
      },
      {
        q: "Can it handle made-to-order and limited-batch items?",
        a: "Yes. The AI sets made-to-order lead times and small-batch quantities so buyers see accurate availability and turnaround, and you're never left selling a one-off piece twice.",
      },
      {
        q: "Writing descriptions for every handmade item takes forever. Does it help?",
        a: "It drafts each product's story, materials, and care details from a photo and a short note, so a new listing takes minutes and every piece reads with the care it was made with.",
      },
      {
        q: "Do I need to be technical to move off the marketplace?",
        a: "No. You describe your shop in plain language, the AI builds it and connects your domain, and you start free for 14 days, so you can test the whole store before your plan begins.",
      },
    ],
    metaTitle: "AI Store Builder for Handmade Makers | mAutomate",
    metaDescription:
      "Leave the marketplace fees behind. mAutomate builds a handmade maker's own AI-run store: product stories, small-batch stock, made-to-order, and support.",
  },
  {
    slug: "subscription-box-brands",
    audience: "Subscription box brands",
    title: "AI Store Builder for Subscription Box Brands",
    h1: "Run a subscription box brand with AI on retention duty",
    intro:
      "mAutomate runs an AI-powered store for subscription box brands. The AI builds your storefront, sets up recurring plans and gift options, markets each month's box, and works retention: winning back failed payments, answering subscriber questions, and reducing churn, so recurring revenue grows without a full ops team behind it.",
    painPoints: [
      "Recurring billing, plan tiers, and gift subscriptions are fiddly to set up and easy to get wrong.",
      "Churn quietly bleeds revenue every month, and failed payments cancel subscribers you'd otherwise have kept.",
      "Each box needs its own reveal and marketing push, and producing that content monthly is relentless.",
      "Subscriber questions about skipping, pausing, swapping, and shipping dates flood support around every renewal.",
    ],
    benefits: [
      {
        title: "Recurring plans and gifting, set up right",
        body: "The AI configures monthly, quarterly, and annual plans, prepaid and gift subscriptions, and tiered boxes, so your billing and options are correct from day one instead of duct-taped together.",
      },
      {
        title: "Retention that works while you sleep",
        body: "The AI recovers failed payments with smart retries and dunning emails, spots at-risk subscribers, and runs win-back flows, protecting the recurring revenue that makes the business work.",
      },
      {
        title: "Monthly box marketing, produced for you",
        body: "The marketing suite writes each month's reveal emails and social teasers and schedules the campaign, so every box gets its launch push without a monthly scramble.",
      },
      {
        title: "Subscriber support on autopilot",
        body: "AI support handles skips, pauses, swaps, address changes, and shipping-date questions around each renewal, in your voice, so the renewal-week ticket spike manages itself.",
      },
    ],
    faq: [
      {
        q: "Can it handle monthly, prepaid, and gift subscriptions?",
        a: "Yes. The AI sets up recurring plans on any cadence, prepaid terms, and gift subscriptions with their own checkout and messaging, so every way a customer wants to subscribe is covered.",
      },
      {
        q: "How does it reduce churn?",
        a: "It recovers failed payments with automatic retries and dunning emails, identifies subscribers likely to cancel, and triggers win-back offers and flows, so avoidable churn is caught before it costs you the subscriber.",
      },
      {
        q: "Can subscribers skip, pause, or swap boxes themselves?",
        a: "Yes. Subscribers manage skips, pauses, swaps, and address changes from their account, and AI support answers the questions around renewals, so those requests don't pile onto your team.",
      },
      {
        q: "Does each month's box get its own marketing?",
        a: "The marketing suite produces the reveal emails and social teasers for each box and schedules the send, so every renewal cycle gets a proper launch without monthly manual work.",
      },
    ],
    metaTitle: "AI Store Builder for Subscription Box Brands | mAutomate",
    metaDescription:
      "Grow a subscription box brand with AI on retention: recurring and gift plans, failed-payment recovery, churn reduction, monthly box marketing, and support.",
  },
]

// Lookup by slug for the dynamic route.
export function getVertical(slug) {
  return VERTICALS.find((v) => v.slug === slug)
}
