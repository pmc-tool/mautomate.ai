/**
 * The API-application playbook — the in-depth, employee-ready guides behind
 * the console's Integrations page. One guide per platform: how to create the
 * developer app, exactly which products/permissions to request (with
 * copy-paste review justifications), how to pass review, how to switch the
 * app live, and how to verify it works on this platform.
 *
 * DATA, not UI: the console renders whatever is here, so keeping guides
 * current is an edit to this file only. `{BACKEND_URL}` tokens are replaced
 * by the route with the live backend origin.
 */

export type GuideLink = { label: string; url: string }
export type GuideCopy = { label: string; value: string }
export type GuideStep = {
  title: string
  details: string[]
  links?: GuideLink[]
  /** Values the employee pastes INTO the platform (copy buttons). */
  copy?: GuideCopy[]
}
export type PermissionRow = {
  permission: string
  usedFor: string
  /** Ready-to-paste review justification. */
  justification: string
}
export type PlatformGuide = {
  /** Matches a PROVIDERS category, or a standalone key like "playbook". */
  key: string
  title: string
  outcome: string
  timeline: string
  prerequisites: string[]
  steps: GuideStep[]
  permissions?: PermissionRow[]
  review?: { title: string; items: string[] }
  golive?: string[]
  verify?: string[]
}

const B = "{BACKEND_URL}"

const JUSTIFY_PREFIX =
  "mAutomate is a multi-tenant e-commerce platform (SaaS). Each merchant runs an online store on our platform and connects their own accounts via OAuth from their dashboard. "

export const GUIDES: PlatformGuide[] = [
  // ------------------------------------------------------------- PLAYBOOK
  {
    key: "playbook",
    title: "The API application playbook — read this first",
    outcome:
      "Every social + ads platform app created, approved, and live, with all keys saved on this page.",
    timeline:
      "Meta 4–8 weeks (start it FIRST — everything else fits inside its review window). X: same day. LinkedIn: same day for posting. Google Ads token: days to weeks (backlogged — file early).",
    prerequisites: [
      "A company email you control (all developer accounts belong to the COMPANY, never a personal account).",
      "Admin access to the company's Facebook Page and Business Portfolio (business.facebook.com).",
      "The live privacy policy URL (https://mautomate.ai/privacy) and terms URL — every platform asks for them.",
      "Business verification documents: certificate of incorporation or trade licence, and a utility bill / bank statement showing the company name + address.",
      "A screen-recording tool for review videos (any screen recorder; 1080p, with the browser URL bar visible).",
      "A logged-in TEST merchant store on mAutomate to demonstrate flows (ask engineering for credentials).",
    ],
    steps: [
      {
        title: "Work in this order",
        details: [
          "1. Meta (Facebook + Instagram + Messenger + WhatsApp + ADS — one single app covers all of it). Its Business Verification + App Review is the long pole: start today.",
          "2. X (Twitter): no review, just tier payment — 30 minutes.",
          "3. LinkedIn: self-serve products for posting — under an hour.",
          "4. Google Ads developer token: file the application now; the integration ships on our side when the token arrives.",
          "Telegram needs NOTHING from you: merchants connect their own bots with a token from @BotFather inside their dashboard.",
        ],
      },
      {
        title: "The golden rule of every app review",
        details: [
          "Reviewers approve what they can SEE working. Meta (and others) let the app work in Development Mode for accounts that belong to the app's own business BEFORE approval — so you connect our test store to the real platform first, make the flow genuinely work, record the screencast of it working, and only then submit.",
          "Never write generic answers. Every permission answer should say WHO uses it (a merchant on our platform), WHERE (their mAutomate dashboard), and WHAT the end user sees. The permission tables in each guide below have ready-to-paste texts.",
          "Keep the reviewer test credentials working for the entire review window — do not change that test store's password mid-review.",
        ],
      },
      {
        title: "When keys arrive, they go HERE",
        details: [
          "Every credential is pasted on this Integrations page, into the field named for it — never into code, never into chat. Values are stored encrypted and take effect within a minute, no deploy needed.",
          "After pasting, use the platform card's verify step (or ask engineering to run the connect flow on the test store) before marking the platform done.",
        ],
      },
    ],
  },

  // ----------------------------------------------------------------- META
  {
    key: "Social · Facebook & Instagram",
    title: "Meta — one app for Facebook, Instagram, Messenger, WhatsApp AND Ads",
    outcome:
      "A LIVE Meta app whose App ID/Secret are saved here. Merchants can then connect Facebook Pages + Instagram for posting and messaging, and connect their ad accounts for the Advertising panel.",
    timeline:
      "App + dev-mode working: 1 day. Business Verification: 5–15 business days. App Review: 1–3 weeks (can loop). Total budget: 4–8 weeks.",
    prerequisites: [
      "Company Business Portfolio at business.facebook.com with you as admin (create it first if missing).",
      "The company Facebook Page.",
      "Privacy policy URL + app icon (1024×1024 PNG of the mAutomate mark).",
      "Business verification documents ready (see playbook).",
    ],
    steps: [
      {
        title: "Create the app",
        details: [
          "developers.facebook.com → My Apps → Create App.",
          "Use case: choose 'Other' → app type 'Business'.",
          "Name it 'mAutomate' and connect it to the company Business Portfolio when asked (required for Business Verification later).",
        ],
        links: [
          { label: "Meta for Developers", url: "https://developers.facebook.com/apps" },
        ],
      },
      {
        title: "Basic settings (do this before anything else)",
        details: [
          "App → Settings → Basic: fill Privacy Policy URL, Terms of Service URL, App Icon, Category ('Business and pages').",
          "App Domains: add mautomate.ai and api.mautomate.ai.",
          "Copy the App ID into the 'Facebook App ID' field on this page, and the App Secret into 'Facebook App Secret'. (The Instagram App Secret field takes the SAME App Secret unless engineering says otherwise.)",
        ],
      },
      {
        title: "Add the products the platform uses",
        details: [
          "From the app dashboard add ALL of: 'Facebook Login for Business', 'Messenger', 'Instagram', 'Webhooks', 'Marketing API'. Add 'WhatsApp' too if we are enabling WhatsApp messaging.",
          "Facebook Login for Business → Settings → Valid OAuth Redirect URIs: paste the three redirect URIs below — each one ENDS IN /callback — one per line. (These are the OAuth redirect URIs, NOT the webhook URLs.) Leave 'Client OAuth login' and 'Web OAuth login' ON, 'Enforce HTTPS' ON.",
        ],
        copy: [
          { label: "Redirect URI — Facebook posting", value: `${B}/marketing-oauth/facebook/callback` },
          { label: "Redirect URI — Instagram posting", value: `${B}/marketing-oauth/instagram/callback` },
          { label: "Redirect URI — Ads (Advertising panel)", value: `${B}/marketing-oauth/ads_meta/callback` },
        ],
      },
      {
        title: "Webhooks (messaging inboxes)",
        details: [
          "Messenger → Settings → Webhooks: Callback URL = the Messenger webhook below (this webhook URL has NO /callback — it is a DIFFERENT URL from the OAuth redirect URIs in the previous step). Verify Token = invent a long random string, paste it BOTH into Meta and into the 'Messenger Webhook Verify Token' field on this page (they must match exactly). Subscribe to: messages, messaging_postbacks.",
          "Instagram → Webhooks: same procedure with the Instagram webhook URL + the 'Instagram Webhook Verify Token' field. Subscribe to: messages.",
          "WhatsApp (if enabling) → Configuration: same procedure with the WhatsApp webhook + its verify token field. Subscribe to: messages.",
          "Meta will call the URL the moment you click Verify — the field on this page must be SAVED FIRST or verification fails.",
        ],
        copy: [
          { label: "Messenger webhook URL", value: `${B}/marketing-webhooks/messenger` },
          { label: "Instagram webhook URL", value: `${B}/marketing-webhooks/instagram` },
          { label: "WhatsApp webhook URL", value: `${B}/marketing-webhooks/whatsapp` },
        ],
      },
      {
        title: "Prove it works in Development Mode (before review!)",
        details: [
          "In dev mode the app fully works for accounts owned by the app's business: add your own Facebook/Instagram accounts under App Roles → Testers if needed.",
          "On the TEST merchant store: Marketing → Social accounts → Connect Facebook — complete the consent, publish a test post. Advertising → Ad accounts → Connect Meta ads — connect the company's own ad account, set up the pixel, create (do not launch) a campaign.",
          "This working flow is exactly what your review screencasts will show.",
        ],
      },
      {
        title: "Business Verification",
        details: [
          "App → Settings → Basic → 'Business verification' (or Business Portfolio → Security Centre → Start Verification).",
          "Submit the legal name, address, and upload the incorporation/licence document + the utility bill/bank statement. Company details must MATCH the documents exactly.",
          "Typical turnaround 5–15 business days. You can prepare the App Review submission while waiting.",
        ],
        links: [
          { label: "Business verification help", url: "https://www.facebook.com/business/help/2058515294227817" },
        ],
      },
      {
        title: "App Review — submission",
        details: [
          "App Review → Permissions and Features: click 'Request advanced access' on EVERY permission in the table below. Each needs: (a) the written justification — use the copy buttons, (b) a screencast, (c) step-by-step reviewer instructions.",
          "Screencast requirements: 1080p screen recording, URL bar visible, no cuts. Show: logging into the test merchant dashboard → clicking Connect → the real Meta consent screen → the feature working end-to-end (a post appearing on the Page / a campaign created paused in Ads Manager / a reply arriving in the inbox). One video can cover several related permissions if it clearly shows each.",
          "Reviewer instructions template: 'Log in at https://merchant.mautomate.ai with the provided credentials. Go to Marketing → Social accounts. Click Connect Facebook and approve. Open Posts, create a post, publish — it appears on the connected Page.' Adjust per permission. Provide the test store login in the review form's test-credentials section.",
        ],
      },
    ],
    permissions: [
      {
        permission: "pages_show_list",
        usedFor: "Listing the merchant's Pages in the connect picker",
        justification:
          JUSTIFY_PREFIX +
          "After OAuth we list the user's Facebook Pages so the merchant chooses which Page their store publishes to. The list is shown once in the connect flow and the chosen Page is stored for that store only.",
      },
      {
        permission: "pages_manage_posts",
        usedFor: "Publishing the merchant's scheduled posts to their Page",
        justification:
          JUSTIFY_PREFIX +
          "Merchants compose and schedule their own store's marketing posts in their dashboard; our scheduler publishes each post to the merchant's OWN connected Page at the chosen time. No content is posted without the merchant creating it.",
      },
      {
        permission: "pages_read_engagement",
        usedFor: "Showing the merchant their own posts' performance",
        justification:
          JUSTIFY_PREFIX +
          "We display each merchant their own published posts' reach and engagement inside their dashboard analytics. Data is shown only to the Page's owner and never shared across merchants.",
      },
      {
        permission: "business_management",
        usedFor: "Reading the Business assets needed to connect Pages/ad accounts",
        justification:
          JUSTIFY_PREFIX +
          "Required to resolve the merchant's business-owned assets (Pages, ad accounts, catalogs) during the connect flows so the merchant can pick which asset their store uses.",
      },
      {
        permission: "instagram_basic",
        usedFor: "Resolving the connected Instagram Business account",
        justification:
          JUSTIFY_PREFIX +
          "Used to identify the Instagram Business account linked to the merchant's Page so their store can publish to it and receive its DMs in the support inbox.",
      },
      {
        permission: "instagram_content_publish",
        usedFor: "Publishing the merchant's posts to their Instagram",
        justification:
          JUSTIFY_PREFIX +
          "Merchants schedule their own Instagram posts in their dashboard; we publish them to the merchant's OWN connected Instagram Business account at the scheduled time.",
      },
      {
        permission: "pages_messaging",
        usedFor: "The merchant's Messenger support inbox",
        justification:
          JUSTIFY_PREFIX +
          "Customers message the merchant's Page; those conversations appear in the merchant's support inbox where the merchant (or their configured assistant) replies. Messages stay within the owning merchant's inbox.",
      },
      {
        permission: "instagram_manage_messages",
        usedFor: "The merchant's Instagram DM support inbox",
        justification:
          JUSTIFY_PREFIX +
          "Same support inbox for Instagram DMs: customers write to the merchant's Instagram account and the merchant answers from their dashboard inbox.",
      },
      {
        permission: "ads_management",
        usedFor: "The Advertising panel — creating/pausing the merchant's campaigns",
        justification:
          JUSTIFY_PREFIX +
          "Merchants run their own ad campaigns from their dashboard: our panel creates campaigns/ad sets/ads on the merchant's OWN ad account (always created paused; the merchant explicitly launches), adjusts their budgets, and pauses on their instruction or their configured rules. Ad spend is billed by Meta to the merchant's own payment method.",
      },
      {
        permission: "ads_read",
        usedFor: "Showing the merchant their own campaign performance",
        justification:
          JUSTIFY_PREFIX +
          "We read the merchant's own campaign insights (spend, impressions, clicks, conversions) to display their advertising dashboard. Data is only ever shown to the ad account's owner.",
      },
      {
        permission: "catalog_management",
        usedFor: "Syncing the merchant's product catalog for catalog ads",
        justification:
          JUSTIFY_PREFIX +
          "With the merchant's consent we create/update a product catalog under the merchant's business containing their own store's products (title, price, image, link) to enable catalog-based ads.",
      },
      {
        permission: "pages_manage_ads",
        usedFor: "Publishing ads that run under the merchant's Page identity",
        justification:
          JUSTIFY_PREFIX +
          "Ads created for the merchant use their OWN Page as the ad identity ('publish as'); this permission lets the campaign creative reference the merchant's chosen Page.",
      },
      {
        permission: "whatsapp_business_messaging",
        usedFor: "The merchant's WhatsApp support inbox (if enabling WhatsApp)",
        justification:
          JUSTIFY_PREFIX +
          "Customers message the merchant's WhatsApp business number; conversations arrive in the merchant's support inbox and replies are sent back within WhatsApp's messaging window.",
      },
    ],
    review: {
      title: "Before you press Submit",
      items: [
        "Business Verification shows VERIFIED.",
        "Privacy policy URL, terms URL, icon, and app domains are set (Live mode is blocked without them).",
        "Dev-mode flow genuinely works on the test store — you watched a post publish and a paused campaign appear in Ads Manager.",
        "Every requested permission has its written justification pasted and a screencast attached.",
        "Reviewer test credentials are in the submission and the test store login works from a clean browser.",
        "Marketing API note: full ad-account access starts at the 'development' tier which already works for our own business's ad accounts; the standard/advanced tier is granted automatically once the app makes 500+ successful Marketing API calls in 15 days with a low error rate — no separate application.",
      ],
    },
    golive: [
      "After approval flip the app from Development to LIVE (toggle at the top of the dashboard).",
      "Re-test the merchant connect flow with a NON-tester account to confirm public users can now authorize.",
      "Annual reminder: Meta requires a yearly Data Use Checkup self-certification — calendar it.",
    ],
    verify: [
      "This page shows Facebook App ID/Secret as Configured.",
      "Test store → Marketing → Social accounts → Connect Facebook completes and lists Pages.",
      "Test store → Advertising → Ad accounts → Meta card is live; connect completes; Tracking & catalog sets up the pixel.",
      "A test post publishes; a paused campaign appears in the merchant's Ads Manager.",
    ],
  },

  // -------------------------------------------------------------------- X
  {
    key: "Social · X (Twitter)",
    title: "X (Twitter) — posting API",
    outcome:
      "An X app with OAuth 2.0 configured; Client ID/Secret saved here; merchants can connect their X profile and publish posts.",
    timeline:
      "Same day. There is NO app review — access is by paid tier.",
    prerequisites: [
      "A company X account (@handle) with a verified email + phone.",
      "Decision on tier: the FREE tier allows only very low write volume (fine for internal testing). For production merchants choose BASIC ($200/month as of 2026 — confirm current pricing on the portal before paying).",
    ],
    steps: [
      {
        title: "Developer account + project",
        details: [
          "developer.x.com → sign up with the company X account → describe the use case as social-media management for our e-commerce merchants.",
          "Create a Project, then an App inside it (name: mAutomate).",
        ],
        links: [{ label: "X Developer Portal", url: "https://developer.x.com/en/portal/dashboard" }],
      },
      {
        title: "User authentication settings (the part people miss)",
        details: [
          "App → 'User authentication settings' → Set up.",
          "App permissions: Read and write. Type of App: Web App, Automated App or Bot (confidential client).",
          "Callback URI: paste the value below exactly. Website URL: https://mautomate.ai.",
          "Save, then from 'Keys and tokens' copy the OAuth 2.0 Client ID and Client Secret into the two X fields on this page. (Ignore the v1 API Key/Secret pair — we use OAuth 2.0.)",
        ],
        copy: [{ label: "Callback URI", value: `${B}/marketing-oauth/x/callback` }],
      },
      {
        title: "Pick and pay the tier",
        details: [
          "Products → subscribe the project to the chosen tier. Posting volume across ALL connected merchants counts against the app's tier limits — revisit the tier as merchant count grows.",
        ],
      },
    ],
    verify: [
      "Test store → Marketing → Social accounts → Connect X completes (PKCE consent).",
      "A test post publishes to the connected profile.",
    ],
  },

  // -------------------------------------------------------------- LINKEDIN
  {
    key: "Social · LinkedIn",
    title: "LinkedIn — member posting",
    outcome:
      "A LinkedIn app with the self-serve posting products enabled; Client ID/Secret saved here; merchants can connect their profile and share posts.",
    timeline:
      "Under an hour for member posting (self-serve). Posting AS a company page needs the partner-gated Community Management API — months, unpredictable; we deliberately ship member posting first.",
    prerequisites: [
      "A LinkedIn COMPANY PAGE (the app must be associated with one, and a page admin must approve the association).",
    ],
    steps: [
      {
        title: "Create the app",
        details: [
          "linkedin.com/developers → Create app. Name: mAutomate. LinkedIn Page: select the company page. Upload the logo, agree, create.",
          "Page association: the company page admin gets a verification prompt (Settings → 'Verify') — have them approve it; several features stay locked until verified.",
        ],
        links: [{ label: "LinkedIn Developers", url: "https://www.linkedin.com/developers/apps" }],
      },
      {
        title: "Enable the products",
        details: [
          "Products tab → request 'Share on LinkedIn' (grants w_member_social — posting) and 'Sign In with LinkedIn using OpenID Connect' (grants openid/profile/email — identity). Both are self-serve and typically approve instantly.",
        ],
      },
      {
        title: "Auth settings",
        details: [
          "Auth tab → OAuth 2.0 settings → Authorized redirect URLs: paste the value below.",
          "Copy Client ID and Client Secret into the two LinkedIn fields on this page.",
        ],
        copy: [{ label: "Redirect URL", value: `${B}/marketing-oauth/linkedin/callback` }],
      },
    ],
    verify: [
      "Test store → Marketing → Social accounts → Connect LinkedIn completes.",
      "A test post appears on the connected member profile.",
    ],
  },

  // ------------------------------------------------------------ WHATSAPP
  {
    key: "Messaging · WhatsApp",
    title: "WhatsApp — merchant support inbox (part of the SAME Meta app)",
    outcome:
      "WhatsApp product configured on the Meta app; webhook verified; App Secret + verify token saved here.",
    timeline: "1 hour of setup inside the Meta app; the permissions ride the same Meta App Review.",
    prerequisites: [
      "The Meta app from the Facebook & Instagram guide (do that first).",
      "A phone number for WhatsApp Business that is NOT registered on the consumer WhatsApp app.",
    ],
    steps: [
      {
        title: "Add the product + number",
        details: [
          "Meta app → Add product → WhatsApp. Link the Business Portfolio when asked; add and verify the business phone number under API Setup.",
        ],
      },
      {
        title: "Webhook",
        details: [
          "WhatsApp → Configuration → Webhook: Callback URL below, Verify Token = a long random string saved FIRST into the 'WhatsApp Webhook Verify Token' field on this page, then pasted into Meta. Subscribe to the 'messages' field.",
          "The 'WhatsApp App Secret' field on this page takes the SAME Meta App Secret (Settings → Basic).",
        ],
        copy: [{ label: "Webhook URL", value: `${B}/marketing-webhooks/whatsapp` }],
      },
      {
        title: "Review",
        details: [
          "whatsapp_business_messaging / whatsapp_business_management are requested in the same Meta App Review — the justification is in the Meta guide's permission table.",
        ],
      },
    ],
    verify: [
      "Meta's webhook Verify succeeds (green check).",
      "A WhatsApp message to the business number appears in the test store's Inbox.",
    ],
  },

  // ------------------------------------------------------------ MESSENGER
  {
    key: "Messaging · Messenger",
    title: "Messenger — merchant support inbox (part of the SAME Meta app)",
    outcome:
      "Messenger webhook verified; App Secret + verify token saved here; Page messages flow into merchant inboxes.",
    timeline: "30 minutes inside the Meta app; permissions ride the same Meta App Review.",
    prerequisites: ["The Meta app from the Facebook & Instagram guide."],
    steps: [
      {
        title: "Webhook",
        details: [
          "Meta app → Messenger → Settings → Webhooks: Callback URL below; Verify Token = a random string saved FIRST into the 'Messenger Webhook Verify Token' field on this page, then into Meta. Subscribe to: messages, messaging_postbacks.",
          "'Messenger App Secret' on this page = the Meta App Secret (Settings → Basic).",
          "pages_messaging is requested in the Meta App Review (justification in the Meta guide).",
        ],
        copy: [{ label: "Webhook URL", value: `${B}/marketing-webhooks/messenger` }],
      },
    ],
    verify: [
      "Webhook Verify succeeds.",
      "A message to the connected test Page arrives in the test store's Inbox.",
    ],
  },

  // ----------------------------------------------------------- GOOGLE ADS
  {
    key: "Ads · Google Ads",
    title: "Google Ads — developer token (apply now, integration ships when granted)",
    outcome:
      "A Google Ads manager account with an approved developer token + an OAuth client; all three values saved here so the Google integration can switch on the day it lands.",
    timeline:
      "Test token: instant. Basic access: officially ~5 business days but currently BACKLOGGED (Google's own notice) — file early and expect weeks. The interim 'Explorer' tier may be auto-granted for pilots.",
    prerequisites: [
      "A Google Workspace account owned by the company.",
      "A Google Ads MANAGER account (MCC) — create at ads.google.com/home/tools/manager-accounts (free).",
      "At least one real advertising account linked under the manager (an account with some spend history materially helps approval).",
    ],
    steps: [
      {
        title: "Developer token",
        details: [
          "Manager account → Admin (wrench) → API Center → apply for the developer token. It starts at TEST access (works only against test accounts) — that is expected.",
          "Copy the token into the 'Google Ads Developer Token' field on this page even while it is test-level.",
        ],
        links: [{ label: "API Center / access levels", url: "https://developers.google.com/google-ads/api/docs/api-policy/access-levels" }],
      },
      {
        title: "Apply for Basic access",
        details: [
          "API Center → 'Apply for Basic access'. Use-case text (adapt freely): 'mAutomate is a multi-tenant e-commerce SaaS. Merchants connect their own Google Ads accounts via OAuth from their store dashboard to create and manage their own campaigns (Performance Max / Shopping) and view their own performance. We never aggregate or resell data across advertisers.'",
          "Common rejection causes to avoid: an unmonitored contact email, a vague use case, no company website, policy issues on the linked accounts.",
        ],
      },
      {
        title: "OAuth client (Google Cloud)",
        details: [
          "console.cloud.google.com → new project 'mAutomate' → APIs & Services → enable 'Google Ads API' → OAuth consent screen (External, publish it) → Credentials → Create OAuth client ID → Web application.",
          "Authorized redirect URI: paste the value below. Copy the Client ID and Client Secret into the two Google fields on this page.",
        ],
        copy: [{ label: "Authorized redirect URI", value: `${B}/marketing-oauth/ads_google/callback` }],
        links: [{ label: "Google Cloud Console", url: "https://console.cloud.google.com/" }],
      },
    ],
    verify: [
      "All three Google fields on this page show Configured.",
      "API Center shows the token's access level — tell engineering when it reaches Basic: the merchant-facing Google card activates then.",
    ],
  },
]

/** Guides with {BACKEND_URL} resolved. */
export const resolvedGuides = (backendUrl: string): PlatformGuide[] => {
  const sub = (s: string) => s.split("{BACKEND_URL}").join(backendUrl)
  return GUIDES.map((g) => ({
    ...g,
    steps: g.steps.map((s) => ({
      ...s,
      details: s.details.map(sub),
      copy: s.copy?.map((c) => ({ ...c, value: sub(c.value) })),
    })),
  }))
}
