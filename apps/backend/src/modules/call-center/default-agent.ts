import { wismoPlaybook } from "./playbooks/wismo"

// ElevenLabs "Rachel" — a real, multilingual voice. Works for English (and can
// carry other languages too), so it's the safe default voice for every store.
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"

/**
 * DEFAULT AGENT — code-verified order-status line.
 *
 * AUTH BY ORDER CODE, NOT SMS OTP. Every order carries a short numeric
 * `support_code` (surfaced to the merchant as the "phone code" on the order
 * detail page and printed on the customer's confirmation). The caller proves
 * ownership by reading that code back; the runtime looks the order up with
 * `findOrders({ order_code })` (exact match on metadata.support_code, tenant
 * scoped). A correct code is the identity gate — we do NOT send an SMS/OTP,
 * because outbound SMS is not wired up and was failing in practice.
 *
 * NO HUMAN TRANSFER. There is no human rep to hand off to yet, so the agent
 * never offers to transfer the call. Anything it can't do on the call is
 * captured as an order note for the store to follow up on.
 *
 * READ-ONLY / NO ETA. The agent speaks only the coarse commerce state
 * (placed/confirmed/shipped) plus any cash-on-delivery amount due, and never
 * invents a delivery date, ETA, or live location.
 */

// The tool schemas the voice runtime exposes to the model. Names map 1:1 to the
// tool registry (tools/registry.ts). We deliberately expose only the code-lookup
// + read + note + control tools — no OTP, no transferToHuman.
const TOOLS = [
  {
    name: "findOrders",
    description:
      "Look up the caller's order by the private numeric order code from their " +
      "order confirmation (the 'phone code' printed on the order). This code is " +
      "the caller's SECRET proof of ownership — a plain order number is NOT " +
      "accepted, because order numbers are guessable and would let anyone read " +
      "someone else's order. Matches within this store and returns the order. " +
      "ALWAYS read the digits back to the caller and get a 'yes' BEFORE calling " +
      "this — phone audio garbles numbers. Do NOT reveal any order detail until " +
      "this returns a matching order.",
    parameters: {
      type: "object",
      properties: {
        order_code: {
          type: "string",
          description:
            "the private numeric code the caller reads from their order " +
            "confirmation (NOT the plain order number)",
        },
      },
      required: ["order_code"],
      additionalProperties: false,
    },
  },
  {
    name: "getOrderStatus",
    description:
      "Compact high-level status (placed/confirmed/shipped + payment) for an " +
      "order whose code the caller has already read back. Read-only. Contains " +
      "NO courier ETA or location.",
    parameters: {
      type: "object",
      properties: { order_id: { type: "string" } },
      required: ["order_id"],
      additionalProperties: false,
    },
  },
  {
    name: "getOrder",
    description:
      "Read the caller's order after their code matched. Read-only.",
    parameters: {
      type: "object",
      properties: { order_id: { type: "string" } },
      required: ["order_id"],
      additionalProperties: false,
    },
  },
  {
    name: "searchProducts",
    description:
      "Search this store's live catalog by free text to answer 'do you have " +
      "X', 'what do you sell', price and availability questions. Returns " +
      "matching products with price and in-stock status. No verification " +
      "needed — this is public catalog info.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "what the caller is looking for",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "getProduct",
    description:
      "Get one product's details (price, stock, description) by title or " +
      "handle when the caller asks about a specific item. Public catalog info.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        handle: { type: "string" },
        product_id: { type: "string" },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "searchKnowledge",
    description:
      "Look up this store's own knowledge base (policies, FAQ, shipping and " +
      "returns rules, opening hours, anything the merchant taught the agent) " +
      "to answer a store-specific question you can't get from a product or " +
      "order lookup. If it returns nothing, say you don't have that info " +
      "rather than guessing.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "addOrderNote",
    description:
      "Record a free-text note (e.g. a change the caller requested, or a " +
      "question you couldn't answer) for the store to follow up on. Does not " +
      "mutate the order. Use this instead of transferring — there is no human " +
      "agent to hand off to. Only call this AFTER findOrders has matched the " +
      "caller's order, so the note attaches to the right order.",
    parameters: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        note: { type: "string" },
      },
      required: ["note"],
      additionalProperties: false,
    },
  },
  {
    name: "setDisposition",
    description: "Record the final call outcome before hanging up.",
    parameters: {
      type: "object",
      properties: {
        outcome: {
          type: "string",
          enum: ["status_provided", "wrong_number", "resolved"],
        },
        reason: { type: "string" },
        notes: { type: "string" },
      },
      required: ["outcome"],
      additionalProperties: false,
    },
  },
  {
    name: "endCall",
    description: "End the call politely.",
    parameters: {
      type: "object",
      properties: { reason: { type: "string" } },
      required: [],
      additionalProperties: false,
    },
  },
]

type Lang = "en" | "bn"

type StateText = { goal: string; sample_lines?: string[] }

type LangPack = {
  style: string
  tone: string
  objective: (name: string) => string
  firstMessage: (name: string) => string
  recording: string
  systemPrompt: string
  states: {
    greeting: StateText
    assist: StateText
    verify_code: StateText
    answer_status: StateText
    closing: StateText
  }
}

// Directives shared by every language: authenticate by the spoken order code,
// never send OTP, never offer a human transfer.
const EN_STYLE =
  "Always speak in clear, natural, everyday spoken English — warm, friendly and " +
  "concise, exactly like a real customer-care agent on the phone. Keep sentences " +
  "short and simple. Never use formal, archaic, or overly technical language."

const EN_DIRECTIVES =
  "You are the store's general phone assistant. Help with ANYTHING about the " +
  "store: what they sell, product availability and prices (use searchProducts / " +
  "getProduct), store policies, shipping and returns, hours (use " +
  "searchKnowledge), and order status. General store and product questions need " +
  "NO verification — answer them directly. " +
  "ORDER-SPECIFIC DETAILS ARE PRIVATE: to tell a caller anything about a " +
  "particular order, first verify them with the PRIVATE order code printed on " +
  "their confirmation, then call findOrders with that code. NEVER accept a plain " +
  "order number as identification — order numbers are guessable and would leak " +
  "other people's orders. Phone audio garbles digits, so ALWAYS read the code " +
  "back digit by digit and get a 'yes' before looking it up; if it doesn't " +
  "match, ask them to repeat it slowly and try again. NEVER send an SMS or a " +
  "one-time code. " +
  "There is NO human agent to transfer to: never offer to transfer or connect " +
  "the caller to a representative. If you genuinely can't help with something, " +
  "and it's about their (already-verified) order, save it with addOrderNote and " +
  "tell them the store will follow up; otherwise just say you don't have that " +
  "information. When reading an order back, share only its high-level status " +
  "(placed/confirmed/shipped/delivered) and any cash-on-delivery amount due — " +
  "never a delivery date, ETA, or location. Only claim you saved a note if the " +
  "tool actually succeeded."

const BN_STYLE =
  "ভাষা: সবসময় সহজ, স্বাভাবিক, মুখের চলিত বাংলায় কথা বলবে — ঠিক যেভাবে বাংলাদেশের মানুষ ফোনে " +
  "সাধারণভাবে কথা বলে। কখনোই সাধু ভাষা, বইয়ের ভাষা বা পুরোনো/কঠিন শব্দ ব্যবহার করবে না। ছোট, " +
  "বন্ধুত্বপূর্ণ বাক্যে কথা বলবে।"

const BN_DIRECTIVES =
  "তুমি স্টোরের সাধারণ ফোন সহকারী। স্টোরের যেকোনো বিষয়ে সাহায্য করবে: তারা কী বিক্রি করে, কোন " +
  "পণ্য আছে কিনা ও দাম (searchProducts / getProduct ব্যবহার করবে), স্টোরের নিয়ম, শিপিং ও রিটার্ন, " +
  "সময়সূচি (searchKnowledge ব্যবহার করবে), এবং অর্ডারের অবস্থা। সাধারণ স্টোর ও পণ্যের প্রশ্নে কোনো " +
  "যাচাই লাগবে না — সরাসরি উত্তর দেবে। " +
  "অর্ডারের নির্দিষ্ট তথ্য গোপনীয়: কোনো নির্দিষ্ট অর্ডারের কথা বলার আগে কাস্টমারকে তার কনফার্মেশনের " +
  "গোপন অর্ডার কোড দিয়ে যাচাই করবে, তারপর সেই কোড দিয়ে findOrders কল করবে। শুধু অর্ডার নম্বর দিয়ে " +
  "কখনো পরিচয় মানবে না — অর্ডার নম্বর সহজে অনুমান করা যায়, তাতে অন্যের অর্ডার ফাঁস হতে পারে। ফোনে " +
  "সংখ্যা ভুল শোনা যায়, তাই লুকআপের আগে সবসময় কোডটি এক এক করে পড়ে শুনিয়ে 'হ্যাঁ' নেবে; না মিললে " +
  "ধীরে আবার বলতে বলবে। কখনো এসএমএস বা ওটিপি পাঠাবে না। " +
  "ট্রান্সফার করার মতো কোনো মানুষ প্রতিনিধি নেই: কখনো ট্রান্সফার বা প্রতিনিধির সাথে যুক্ত করার প্রস্তাব " +
  "দেবে না। যদি সত্যিই কিছু করতে না পারো এবং সেটা কাস্টমারের (যাচাইকৃত) অর্ডার সম্পর্কিত হয়, তবে " +
  "addOrderNote দিয়ে লিখে রাখবে ও জানাবে স্টোর যোগাযোগ করবে; নয়তো শুধু বলবে এই তথ্য তোমার কাছে " +
  "নেই। অর্ডার পড়ে শোনানোর সময় শুধু উচ্চপর্যায়ের অবস্থা (প্লেসড/কনফার্মড/শিপড/ডেলিভারড) আর ক্যাশ অন " +
  "ডেলিভারির বকেয়া টাকা বলবে — কখনো ডেলিভারির তারিখ, সময় বা লোকেশন বলবে না। নোট সত্যিই সেভ হলে " +
  "তবেই বলবে যে নোট রেখেছ।"

const PACKS: Record<Lang, LangPack> = {
  en: {
    style: EN_STYLE,
    tone: "warm, friendly, natural, professional",
    objective: (name) =>
      `Be the friendly phone assistant for the ${name} store. Help callers with ` +
      `anything about the store — what it sells, product prices and ` +
      `availability, store policies, shipping and returns — and with their ` +
      `order status. General store and product questions need no verification. ` +
      `Order-specific details are private: verify the caller with the secret ` +
      `order code from their confirmation before revealing anything about a ` +
      `specific order. Read-only on orders; never state a delivery ETA or ` +
      `location.`,
    firstMessage: (name) =>
      `Hi! Thanks for calling ${name}. This call may be recorded for quality. ` +
      `How can I help you today — a question about our products or store, or ` +
      `checking on an order?`,
    recording: "This call may be recorded for quality assurance.",
    systemPrompt: `${EN_STYLE}\n\n${EN_DIRECTIVES}`,
    states: {
      greeting: {
        goal:
          "Greet the caller warmly and give the recording disclosure, then find " +
          "out what they need. If it's a general question about products, " +
          "prices, availability, or store policy, help them right away (no " +
          "verification needed). If they want details about a specific order, " +
          "move to verifying their order code. Reveal NOTHING about any " +
          "specific order until they've passed the code check.",
        sample_lines: [
          "How can I help you today — a product or store question, or an order?",
        ],
      },
      assist: {
        goal:
          "Answer the caller's general question about the store: use " +
          "searchProducts / getProduct for what's available and prices, and " +
          "searchKnowledge for policies, shipping, returns, hours, and other " +
          "store info. If searchKnowledge returns nothing, say you don't have " +
          "that detail rather than guessing. No verification is needed for " +
          "this public info. If they then want details about their own order, " +
          "move to verifying their order code. When they're done, close warmly.",
        sample_lines: [
          "Let me check that for you.",
          "We do have that — would you like the price and whether it's in stock?",
          "I don't have that detail on hand, sorry — is there anything else I can help with?",
        ],
      },
      verify_code: {
        goal:
          "Ask for the caller's PRIVATE order code — the numeric code printed " +
          "on their order confirmation. Do NOT accept a plain order number: it " +
          "is guessable and would leak someone else's order. CRITICAL: phone " +
          "audio garbles digits, so ALWAYS read the code back and get a clear " +
          "'yes' BEFORE you look it up — say it digit by digit, e.g. 'I heard " +
          "seven, eight, one, four, five, eight — is that right?'. Only after " +
          "they confirm, call findOrders with order_code. If it returns a " +
          "matching order, go to answer_status. If there's no match, tell them " +
          "it didn't match and ask them to read it again slowly, one digit at a " +
          "time; retry up to three times. If still nothing, set disposition " +
          "wrong_number and close politely. Never reveal any order detail until " +
          "findOrders returns a match, and never send an SMS or OTP.",
        sample_lines: [
          "Sure — could you read me the order code printed on your order confirmation?",
          "Let me read that back to make sure I got it right.",
          "Hmm, that one didn't match — could you read it again slowly, one digit at a time?",
        ],
      },
      answer_status: {
        goal:
          "The code matched, so the caller is verified for this order. Read " +
          "back ONLY the high-level status from getOrderStatus / getOrder: " +
          "whether it's placed/confirmed or shipped, and — for cash on " +
          "delivery — the amount due. NEVER state or estimate a delivery date, " +
          "ETA, or location. If they ask when it will arrive, explain you " +
          "can't give an exact time yet. If they want to change something " +
          "(address, cancel, etc.), capture it with addOrderNote so the store " +
          "can follow up — do NOT promise it's done and do NOT try to transfer " +
          "the call. Set disposition status_provided when finished.",
        sample_lines: [
          "Your order number {{display_id}} is currently: {{fulfillment_status}}.",
          "I can't give you an exact delivery time yet, but I've noted your request so the store can follow up.",
        ],
      },
      closing: {
        goal:
          "Thank the caller and end the call. A disposition MUST be set before " +
          "hangup.",
        sample_lines: ["Thanks so much for calling {{STORE}}. Have a great day!"],
      },
    },
  },
  bn: {
    style: BN_STYLE,
    tone: "warm, friendly, natural, casual",
    objective: (name) =>
      `${name} স্টোরের বন্ধুত্বপূর্ণ ফোন সহকারী হও। স্টোরের যেকোনো বিষয়ে সাহায্য করো — তারা কী ` +
      `বিক্রি করে, পণ্যের দাম ও প্রাপ্যতা, স্টোরের নিয়ম, শিপিং ও রিটার্ন — এবং অর্ডারের অবস্থা। ` +
      `সাধারণ স্টোর ও পণ্যের প্রশ্নে যাচাই লাগবে না। অর্ডারের নির্দিষ্ট তথ্য গোপনীয়: কোনো নির্দিষ্ট ` +
      `অর্ডারের কথা বলার আগে কাস্টমারকে কনফার্মেশনের গোপন অর্ডার কোড দিয়ে যাচাই করো। অর্ডারে শুধু ` +
      `পড়া যাবে; কখনো ডেলিভারির সময় বা লোকেশন বলবে না।`,
    firstMessage: (name) =>
      `আসসালামু আলাইকুম! ${name}-এ কল করার জন্য ধন্যবাদ। মান নিয়ন্ত্রণের জন্য কলটি রেকর্ড করা ` +
      `হচ্ছে। বলুন, কীভাবে সাহায্য করতে পারি — পণ্য বা স্টোর নিয়ে কোনো প্রশ্ন, নাকি কোনো অর্ডার?`,
    recording: "মান নিয়ন্ত্রণের জন্য এই কলটি রেকর্ড করা হচ্ছে।",
    systemPrompt: `${BN_STYLE}\n\n${BN_DIRECTIVES}`,
    states: {
      greeting: {
        goal:
          "উষ্ণভাবে সালাম/শুভেচ্ছা দাও, জানাও কলটি রেকর্ড হচ্ছে, তারপর জানতে চাও কীভাবে সাহায্য " +
          "করতে পারো। পণ্য, দাম, প্রাপ্যতা বা স্টোরের নিয়ম নিয়ে সাধারণ প্রশ্ন হলে সঙ্গে সঙ্গে সাহায্য " +
          "করো (কোনো যাচাই লাগবে না)। নির্দিষ্ট অর্ডারের তথ্য চাইলে অর্ডার কোড যাচাইয়ের দিকে যাও। কোড " +
          "যাচাই না হওয়া পর্যন্ত কোনো নির্দিষ্ট অর্ডারের তথ্য দিও না।",
        sample_lines: [
          "বলুন, কীভাবে সাহায্য করতে পারি — পণ্য বা স্টোর নিয়ে প্রশ্ন, নাকি কোনো অর্ডার?",
        ],
      },
      assist: {
        goal:
          "কাস্টমারের স্টোর সম্পর্কিত সাধারণ প্রশ্নের উত্তর দাও: কী আছে ও দাম জানতে searchProducts / " +
          "getProduct ব্যবহার করো, আর নিয়ম, শিপিং, রিটার্ন, সময়সূচি ইত্যাদির জন্য searchKnowledge। " +
          "searchKnowledge কিছু না দিলে অনুমান না করে বলো এই তথ্য তোমার কাছে নেই। এই পাবলিক তথ্যের " +
          "জন্য যাচাই লাগবে না। এরপর নিজের অর্ডারের তথ্য চাইলে কোড যাচাইয়ের দিকে যাও। কাজ শেষ হলে " +
          "উষ্ণভাবে কল শেষ করো।",
        sample_lines: [
          "একটু দেখে নিচ্ছি আপনার জন্য।",
          "হ্যাঁ, এটা আমাদের আছে — দাম আর স্টকে আছে কিনা বলব?",
          "দুঃখিত, এই তথ্যটা এই মুহূর্তে আমার কাছে নেই — আর কিছুতে সাহায্য করতে পারি?",
        ],
      },
      verify_code: {
        goal:
          "কাস্টমারের গোপন অর্ডার কোড চাও — কনফার্মেশনে ছাপানো সংখ্যার কোড। শুধু অর্ডার নম্বর মানবে " +
          "না: এটা সহজে অনুমান করা যায়, অন্যের অর্ডার ফাঁস হতে পারে। খুব জরুরি: ফোনে সংখ্যা প্রায়ই ভুল " +
          "শোনা যায়, তাই লুকআপের আগে সবসময় কোডটি এক এক করে পড়ে শুনিয়ে নিশ্চিত করো — যেমন 'আমি " +
          "শুনলাম সাত-আট-এক-চার-পাঁচ-আট, ঠিক আছে?'। 'হ্যাঁ' বললে তবেই order_code দিয়ে findOrders কল " +
          "করো। মিলে গেলে answer_status এ যাও। না মিললে জানাও মিলছে না, ধীরে এক এক সংখ্যা করে আবার " +
          "বলতে বলো — সর্বোচ্চ তিনবার। তবুও না মিললে disposition wrong_number সেট করে কল শেষ করো। মিল " +
          "না হওয়া পর্যন্ত অর্ডারের কোনো তথ্য দিও না, আর কখনো এসএমএস বা ওটিপি পাঠাবে না।",
        sample_lines: [
          "নিশ্চয়ই — আপনার অর্ডার কনফার্মেশনে ছাপানো কোডটি একটু পড়ে শোনাবেন?",
          "একটু মিলিয়ে নিই, ঠিকমতো শুনেছি কিনা।",
          "এটা মিলছে না — একটু ধীরে, এক এক সংখ্যা করে আবার বলবেন?",
        ],
      },
      answer_status: {
        goal:
          "কোড মিলে গেছে, তাই কাস্টমার এই অর্ডারের জন্য যাচাইকৃত। getOrderStatus / getOrder থেকে " +
          "শুধু উচ্চপর্যায়ের অবস্থা বলো — অর্ডার প্লেসড/কনফার্মড নাকি শিপড, আর ক্যাশ অন ডেলিভারি হলে " +
          "বকেয়া টাকার পরিমাণ। কখনো নির্দিষ্ট ডেলিভারির তারিখ, সময় বা লোকেশন বলবে না। কবে পৌঁছাবে " +
          "জানতে চাইলে বলো এখনই নির্দিষ্ট সময় বলা যাচ্ছে না। কিছু পরিবর্তন চাইলে (ঠিকানা, বাতিল " +
          "ইত্যাদি) addOrderNote দিয়ে নোট রাখো যেন স্টোর পরে যোগাযোগ করতে পারে — কল ট্রান্সফার করার " +
          "চেষ্টা করবে না। শেষ হলে disposition status_provided সেট করো।",
        sample_lines: [
          "আপনার {{display_id}} নম্বর অর্ডারটির বর্তমান অবস্থা: {{fulfillment_status}}।",
          "এখনই নির্দিষ্ট ডেলিভারির সময় বলতে পারছি না, তবে আপনার অনুরোধটি নোট করে রেখেছি, স্টোর থেকে যোগাযোগ করা হবে।",
        ],
      },
      closing: {
        goal:
          "ধন্যবাদ জানিয়ে কল শেষ করো। হ্যাংআপের আগে অবশ্যই একটি disposition সেট করবে।",
        sample_lines: ["{{STORE}}-এ কল করার জন্য ধন্যবাদ। ভালো থাকবেন!"],
      },
    },
  },
}

// State machine skeleton (ids / allowed_tools / transitions) — language-neutral.
// General store help (products, catalog, store policies) needs NO verification.
// Order-specific detail is gated: the private order code IS the identity gate —
// verify_code exposes findOrders only, and order-read/note tools appear only
// after the code has matched.
const GENERAL_TOOLS = ["searchProducts", "getProduct", "searchKnowledge"]
const STATE_FLOW = [
  {
    id: "greeting",
    allowed_tools: [...GENERAL_TOOLS, "setDisposition", "endCall"],
    transitions: [
      { on: "order_query", to: "verify_code" },
      { on: "general_query", to: "assist" },
    ],
  },
  {
    id: "assist",
    allowed_tools: [...GENERAL_TOOLS, "setDisposition", "endCall"],
    transitions: [
      { on: "wants_order", to: "verify_code" },
      { on: "done", to: "closing" },
    ],
  },
  {
    id: "verify_code",
    allowed_tools: ["findOrders", "setDisposition", "endCall"],
    transitions: [
      { on: "matched", to: "answer_status" },
      { on: "not_found", to: "closing" },
    ],
  },
  {
    id: "answer_status",
    allowed_tools: [
      "getOrder",
      "getOrderStatus",
      "addOrderNote",
      ...GENERAL_TOOLS,
      "setDisposition",
      "endCall",
    ],
    transitions: [{ on: "done", to: "closing" }],
  },
  {
    id: "closing",
    allowed_tools: ["setDisposition", "endCall"],
    transitions: [],
  },
] as const

/**
 * Build the DEFAULT agent definition for a store. English by default; pass
 * language "bn" for the natural-Bangla variant. Every store gets this
 * pre-trained, code-verified order-status assistant so a non-technical merchant
 * has a working call center out of the box; they can retrain it (including
 * changing the language) afterwards.
 */
export function buildDefaultAgentDefinition(
  storeName: string,
  language: Lang = "en"
): Record<string, any> {
  const name = (storeName || "our store").trim() || "our store"
  const pack = PACKS[language] ?? PACKS.en

  const sub = (line: string) =>
    line.split("{{STORE}}").join(name)

  return {
    persona: {
      name: `${name} Support`,
      voice_provider: "elevenlabs",
      voice_id: DEFAULT_VOICE_ID,
      language,
      tone: pack.tone,
      style: pack.style,
    },
    objective: pack.objective(name),
    first_message: pack.firstMessage(name),
    merge_fields: wismoPlaybook.merge_fields,
    states: STATE_FLOW.map((s) => {
      const txt = (pack.states as Record<string, StateText>)[s.id]
      return {
        id: s.id,
        goal: txt?.goal ?? "",
        sample_lines: (txt?.sample_lines ?? []).map(sub),
        allowed_tools: [...s.allowed_tools],
        transitions: s.transitions.map((t) => ({ ...t })),
      }
    }),
    tools: TOOLS,
    guardrails: {
      max_turns: 24,
      max_clarify: 2,
      recording_disclosure: pack.recording,
    },
    system_prompt: pack.systemPrompt,
    disposition_set: ["status_provided", "wrong_number", "resolved"],
  }
}

/**
 * Idempotently provision the default agent for a tenant. Skips ONLY if the store
 * already has a PUBLISHED agent (a mere draft doesn't count). Never clobbers a
 * merchant's own work. Wrap in try/catch during provisioning so a failure never
 * blocks store creation.
 */
export async function provisionDefaultAgent(
  cc: any,
  tenant: { id: string; name?: string | null }
): Promise<{ created: boolean; id?: string }> {
  const tenant_id = tenant.id
  const existing = await cc.listPlaybooks({ tenant_id }, { take: 50 }).catch(() => [])
  const hasPublished =
    Array.isArray(existing) && existing.some((p: any) => p.status === "published")
  if (hasPublished) {
    return { created: false }
  }

  const storeName = tenant.name || "our store"
  const definition = buildDefaultAgentDefinition(storeName)

  const playbook = await cc.createPlaybooks({
    tenant_id,
    name: `${storeName} Assistant`,
    use_case: "order_status",
    status: "published",
  })
  const version = await cc.createPlaybookVersions({
    tenant_id,
    playbook_id: playbook.id,
    version: 1,
    definition,
    published: true,
  })
  await cc.updatePlaybooks({ id: playbook.id, current_version_id: version.id })
  return { created: true, id: playbook.id }
}
