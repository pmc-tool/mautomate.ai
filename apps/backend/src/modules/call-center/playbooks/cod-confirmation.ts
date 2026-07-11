import { Playbook } from "./types"

/**
 * COD order-confirmation playbook — the flagship call-center brain.
 *
 * Pilot market: BANGLADESH. Language: BENGALI (bn). The agent calls a customer
 * who placed a Cash-on-Delivery order, verifies identity, reads back the order,
 * then branches on the customer's intent: confirm, change address, reschedule,
 * cancel, escalate suspected fraud, or hand off when unclear.
 *
 * Tool exposure is state-gated: destructive tools (notably `cancelOrder`) are
 * ONLY listed in the state where they are appropriate and are NEVER exposed at
 * opening. The registry's `compileSystemPrompt` emits only the current state's
 * allowed tools, and `guardrails.ts` rejects any tool call outside that set.
 *
 * The Bengali strings below carry an English gloss in a trailing comment so a
 * non-Bengali integrator can sanity-check them.
 */
export const codConfirmationPlaybook: Playbook = {
  id: "cod-confirmation",
  use_case: "order_confirmation",
  version: 1,

  persona: {
    name: "Forever Finds order line",
    voice_provider: "elevenlabs",
    voice_id: "bn-female-warm",
    language: "bn",
    tone: "warm, polite, concise, professional",
  },

  objective:
    "Confirm a Cash-on-Delivery order with the customer over the phone: " +
    "verify you are speaking with the right person, read back the order " +
    "accurately, and capture a clear outcome (confirm / change address / " +
    "reschedule / cancel / escalate). Never pressure the customer.",

  // আসসালামু আলাইকুম! আমি Forever Finds অর্ডার লাইন থেকে বলছি। আপনি কি {{customer_name}} বলছেন?
  // আপনার {{display_id}} নম্বর অর্ডারটি — যেটি ক্যাশ অন ডেলিভারিতে দেওয়া হয়েছে — নিশ্চিত করতে কল করেছি।
  // (EN gloss: "Peace be upon you! I'm calling from the Forever Finds order line.
  //  Am I speaking with {{customer_name}}? I'm calling to confirm your order number
  //  {{display_id}}, which was placed as Cash on Delivery.")
  first_message:
    "আসসালামু আলাইকুম! আমি Forever Finds অর্ডার লাইন থেকে বলছি। " +
    "আপনি কি {{customer_name}} বলছেন? আপনার {{display_id}} নম্বর অর্ডারটি — " +
    "যেটি ক্যাশ অন ডেলিভারিতে দেওয়া হয়েছে — নিশ্চিত করতে কল করেছি।",

  // Only fields on this whitelist are ever read into the prompt / first message.
  merge_fields: [
    "customer_name",
    "display_id",
    "order_total",
    "currency_code",
    "item_summary",
    "item_count",
    "shipping_city",
    "shipping_address_1",
    "payment_status",
    "fulfillment_status",
  ],

  states: [
    {
      id: "opening_verify_identity",
      goal:
        "Greet, state who is calling and why, and confirm you are speaking " +
        "with the order's owner before revealing any order details. If the " +
        "person is not the customer or says wrong number, do not disclose " +
        "details — set disposition wrong_number and end politely.",
      sample_lines: [
        // আপনি কি {{customer_name}}? একটু আপনার অর্ডারটি সম্পর্কে কথা বলতে পারি?
        // (EN: "Are you {{customer_name}}? May I speak with you briefly about your order?")
        "আপনি কি {{customer_name}}? একটু আপনার অর্ডারটি সম্পর্কে কথা বলতে পারি?",
      ],
      allowed_tools: ["getOrder", "setDisposition", "transferToHuman", "endCall"],
      transitions: [
        { on: "identity_confirmed", to: "summarize_order" },
        { on: "wrong_person", to: "closing" },
        { on: "no_answer", to: "closing" },
      ],
    },
    {
      id: "summarize_order",
      goal:
        "Read back the order clearly and accurately using ONLY the provided " +
        "merge data: order number, items, total, and delivery city/address. " +
        "Ask the customer to confirm it, then listen for their intent.",
      sample_lines: [
        // আপনার অর্ডারে আছে {{item_summary}}, মোট {{order_total}} {{currency_code}}, ডেলিভারি হবে {{shipping_city}}-তে। ঠিক আছে কি?
        // (EN: "Your order has {{item_summary}}, total {{order_total}} {{currency_code}},
        //  delivering to {{shipping_city}}. Is that correct?")
        "আপনার অর্ডারে আছে {{item_summary}}, মোট {{order_total}} {{currency_code}}, " +
          "ডেলিভারি হবে {{shipping_city}}-তে। এটা কি ঠিক আছে?",
        // Keypad fallback — robust to weak Bengali STT. Offer it explicitly.
        // (EN: "To confirm press 1, to cancel press 2, to change the delivery
        //  time press 3 — or just tell me.")
        "নিশ্চিত করতে ১ চাপুন, বাতিল করতে ২ চাপুন, ডেলিভারির সময় বদলাতে ৩ চাপুন — " +
          "অথবা আমাকে বলুন।",
      ],
      allowed_tools: ["getOrder", "setDisposition", "transferToHuman", "endCall"],
      transitions: [
        { on: "customer_confirms", to: "confirm" },
        { on: "wants_address_change", to: "change_address" },
        { on: "wants_reschedule", to: "reschedule" },
        { on: "wants_cancel", to: "cancel" },
        { on: "suspicious", to: "suspected_fraud" },
        { on: "unclear", to: "unclear" },
      ],
    },
    {
      id: "confirm",
      goal:
        "The customer confirmed the order as-is. Record the confirmation and " +
        "thank them. Set disposition confirmed.",
      sample_lines: [
        // ধন্যবাদ! আপনার অর্ডারটি নিশ্চিত করা হলো, শীঘ্রই ডেলিভারি পেয়ে যাবেন।
        // (EN: "Thank you! Your order is confirmed, you'll receive delivery soon.")
        "ধন্যবাদ! আপনার অর্ডারটি নিশ্চিত করা হলো, শীঘ্রই ডেলিভারি পেয়ে যাবেন।",
      ],
      allowed_tools: ["confirmOrder", "addOrderNote", "setDisposition", "endCall"],
      transitions: [{ on: "done", to: "closing" }],
    },
    {
      id: "change_address",
      goal:
        "Capture a corrected shipping address from the customer (recipient " +
        "name, full address, area/city). Confirm the corrected address back " +
        "before saving it. Save the change AT MOST ONCE. Set disposition " +
        "confirmed_with_changes.",
      sample_lines: [
        // নতুন ঠিকানাটি একটু বলবেন? আমি লিখে নিচ্ছি এবং আবার পড়ে শোনাবো।
        // (EN: "Could you tell me the new address? I'll note it and read it back.")
        "নতুন ঠিকানাটি একটু বলবেন? আমি লিখে নিচ্ছি এবং আবার পড়ে শোনাবো।",
      ],
      allowed_tools: [
        "updateShippingAddress",
        "addOrderNote",
        "setDisposition",
        "endCall",
      ],
      transitions: [{ on: "done", to: "closing" }],
    },
    {
      id: "reschedule",
      goal:
        "Capture a preferred delivery date/time window from the customer. " +
        "Confirm it back, then save the reschedule AT MOST ONCE. Set " +
        "disposition rescheduled.",
      sample_lines: [
        // কোন দিন ডেলিভারি চাইছেন? আমি সেই অনুযায়ী সময় ঠিক করে দিচ্ছি।
        // (EN: "Which day would you like delivery? I'll set the time accordingly.")
        "কোন দিন ডেলিভারি চাইছেন? আমি সেই অনুযায়ী সময় ঠিক করে দিচ্ছি।",
      ],
      allowed_tools: [
        "rescheduleDelivery",
        "addOrderNote",
        "setDisposition",
        "endCall",
      ],
      transitions: [{ on: "done", to: "closing" }],
    },
    {
      id: "cancel",
      goal:
        "The customer wants to cancel. Politely confirm the intent once, " +
        "capture the reason, then cancel the order. `cancelOrder` is ONLY " +
        "available in this state. Set disposition cancelled_by_customer.",
      sample_lines: [
        // আপনি কি অর্ডারটি বাতিল করতে চাইছেন? কারণটি জানতে পারি?
        // (EN: "Do you want to cancel the order? May I know the reason?")
        "আপনি কি অর্ডারটি বাতিল করতে চাইছেন? কারণটি জানতে পারি?",
      ],
      allowed_tools: ["cancelOrder", "addOrderNote", "setDisposition", "endCall"],
      transitions: [{ on: "done", to: "closing" }],
    },
    {
      id: "suspected_fraud",
      goal:
        "Signals suggest a fraudulent or non-genuine order (denies ordering, " +
        "abusive, mismatched details). Do NOT accuse. Flag the order for " +
        "human review and, if needed, transfer. Set disposition " +
        "flagged_fraud_review.",
      sample_lines: [
        // ধন্যবাদ, বিষয়টি আমি আমাদের টিমকে জানিয়ে দিচ্ছি, তারা যাচাই করে দেখবে।
        // (EN: "Thank you, I'm noting this for our team to review.")
        "ধন্যবাদ, বিষয়টি আমি আমাদের টিমকে জানিয়ে দিচ্ছি, তারা যাচাই করে দেখবে।",
      ],
      allowed_tools: [
        "flagOrder",
        "addOrderNote",
        "setDisposition",
        "transferToHuman",
        "endCall",
      ],
      transitions: [{ on: "done", to: "closing" }],
    },
    {
      id: "unclear",
      goal:
        "Intent could not be understood within the clarify budget. Apologize, " +
        "note the call, and hand off to a human agent or set needs_agent.",
      sample_lines: [
        // দুঃখিত, আমি ঠিক বুঝতে পারিনি। আমাদের একজন প্রতিনিধি আপনার সাথে যোগাযোগ করবেন।
        // (EN: "Sorry, I couldn't quite understand. One of our agents will contact you.")
        "দুঃখিত, আমি ঠিক বুঝতে পারিনি। আমাদের একজন প্রতিনিধি আপনার সাথে যোগাযোগ করবেন।",
      ],
      allowed_tools: [
        "addOrderNote",
        "setDisposition",
        "transferToHuman",
        "endCall",
      ],
      transitions: [{ on: "done", to: "closing" }],
    },
    {
      id: "closing",
      goal:
        "Close politely, restate the agreed outcome in one line, thank the " +
        "customer, and end the call. Ensure a disposition has been set.",
      sample_lines: [
        // আপনার সময়ের জন্য ধন্যবাদ। ভালো থাকবেন, আল্লাহ হাফেজ।
        // (EN: "Thank you for your time. Take care, goodbye.")
        "আপনার সময়ের জন্য ধন্যবাদ। ভালো থাকবেন, আল্লাহ হাফেজ।",
      ],
      allowed_tools: ["setDisposition", "endCall"],
    },
  ],

  tools: [
    {
      name: "getOrder",
      description:
        "Read the current order details (items, total, address, statuses). " +
        "Read-only; use to re-check facts, never to invent them.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "The order id to read." },
        },
        required: ["order_id"],
        additionalProperties: false,
      },
    },
    {
      name: "confirmOrder",
      description: "Mark the COD order as confirmed by the customer.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string" },
          note: {
            type: "string",
            description: "Optional short note about the confirmation.",
          },
        },
        required: ["order_id"],
        additionalProperties: false,
      },
    },
    {
      name: "rescheduleDelivery",
      description:
        "Reschedule the delivery to a customer-preferred date/time window.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string" },
          preferred_date: {
            type: "string",
            description: "Preferred delivery date, ISO-8601 (YYYY-MM-DD).",
          },
          time_window: {
            type: "string",
            description: "Optional window, e.g. 'morning', '2pm-5pm'.",
          },
        },
        required: ["order_id", "preferred_date"],
        additionalProperties: false,
      },
    },
    {
      name: "updateShippingAddress",
      description:
        "Update the order's shipping address to a corrected value the " +
        "customer dictated and confirmed back.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string" },
          recipient_name: { type: "string" },
          address_1: { type: "string", description: "Street / house / road." },
          address_2: { type: "string" },
          city: { type: "string" },
          province: { type: "string", description: "District / division." },
          postal_code: { type: "string" },
          phone: { type: "string" },
        },
        required: ["order_id", "address_1", "city"],
        additionalProperties: false,
      },
    },
    {
      name: "cancelOrder",
      description:
        "Cancel the order at the customer's explicit request. Only available " +
        "in the cancel state.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string" },
          reason: {
            type: "string",
            description: "Customer-stated reason for cancellation.",
          },
        },
        required: ["order_id", "reason"],
        additionalProperties: false,
      },
    },
    {
      name: "flagOrder",
      description:
        "Flag the order for human fraud/quality review with a reason. Does " +
        "not accuse the customer; just routes for review.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string" },
          reason: { type: "string" },
        },
        required: ["order_id", "reason"],
        additionalProperties: false,
      },
    },
    {
      name: "addOrderNote",
      description: "Attach a short free-text note to the order for agents.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string" },
          note: { type: "string" },
        },
        required: ["order_id", "note"],
        additionalProperties: false,
      },
    },
    {
      name: "setDisposition",
      description:
        "Record the final call outcome. Must be one of the playbook's " +
        "disposition_set values.",
      parameters: {
        type: "object",
        properties: {
          disposition: {
            type: "string",
            enum: [
              "confirmed",
              "confirmed_with_changes",
              "rescheduled",
              "cancelled_by_customer",
              "flagged_fraud_review",
              "needs_agent",
              "wrong_number",
              "no_answer",
              "unreachable",
            ],
          },
          note: { type: "string" },
        },
        required: ["disposition"],
        additionalProperties: false,
      },
    },
    {
      name: "transferToHuman",
      description:
        "Hand the live call off to a human agent when the situation is out " +
        "of scope or the customer requests it.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" },
        },
        required: ["reason"],
        additionalProperties: false,
      },
    },
    {
      name: "endCall",
      description: "End the call politely once the outcome is captured.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  ],

  guardrails: {
    max_turns: 30,
    max_clarify: 2,
    save_offer_once: true,
    // মান নিয়ন্ত্রণের জন্য এই কলটি রেকর্ড করা হচ্ছে।
    // (EN: "This call is being recorded for quality assurance.")
    recording_disclosure: "মান নিয়ন্ত্রণের জন্য এই কলটি রেকর্ড করা হচ্ছে।",
  },

  disposition_set: [
    "confirmed",
    "confirmed_with_changes",
    "rescheduled",
    "cancelled_by_customer",
    "flagged_fraud_review",
    "needs_agent",
    "wrong_number",
    "no_answer",
    "unreachable",
  ],
  // Keypad shortcuts — a pressed digit is an EXPLICIT, unambiguous intent that
  // bypasses Bengali STT (which mis-hears "order" and taka amounts). The runtime
  // maps digit -> intent and the model acts on it immediately without re-asking.
  dtmf_map: {
    "1": "confirm",
    "2": "cancel",
    "3": "reschedule",
  },
}

export default codConfirmationPlaybook
