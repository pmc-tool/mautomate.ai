"use client"

import React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Swatch,
  RocketLaunch,
  Phone,
  CheckCircleSolid,
  InformationCircleSolid,
} from "@medusajs/icons"
import { PageHeader } from "@components/merchant-admin/page-header"
import { SectionCard } from "@components/merchant-admin/section-card"

function Step({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-grey-90 text-xs font-semibold text-white">
        {n}
      </span>
      <div className="pt-0.5">
        <p className="text-sm font-semibold text-grey-90">{title}</p>
        <div className="mt-1 text-sm leading-relaxed text-grey-60">{children}</div>
      </div>
    </li>
  )
}

function Note({
  tone = "info",
  children,
}: {
  tone?: "info" | "success"
  children: React.ReactNode
}) {
  const styles =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-sky-200 bg-sky-50 text-sky-900"
  const Icon = tone === "success" ? CheckCircleSolid : InformationCircleSolid
  const iconColor = tone === "success" ? "text-emerald-500" : "text-sky-500"
  return (
    <div className={`flex items-start gap-2.5 rounded-base border px-4 py-3 text-sm ${styles}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}

export default function MobileAppGuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/mobile-app"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-grey-50 transition-colors hover:text-grey-90"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Mobile App
      </Link>

      <PageHeader
        title="Publishing your mobile app"
        description="A step-by-step guide to editing your app and getting it onto Google Play and the Apple App Store."
      />

      <div className="space-y-6">
        {/* Editing */}
        <SectionCard
          title="1. Edit your app"
          description="Set these up first — they carry through to both app stores."
          icon={Swatch}
        >
          <ol className="space-y-5">
            <Step n={1} title="Change the app name">
              On the Mobile App page, type your store name into{" "}
              <span className="font-medium text-grey-90">App name</span>. Keep it short (30
              characters or fewer) so it doesn&apos;t get cut off under your icon on the
              phone&apos;s home screen.
            </Step>
            <Step n={2} title="Upload or replace the app icon">
              Under <span className="font-medium text-grey-90">App icon</span>, upload a{" "}
              <span className="font-medium text-grey-90">1024&times;1024</span> pixel PNG.
              Use a <span className="font-medium text-grey-90">flat, square</span> image with{" "}
              <span className="font-medium text-grey-90">no transparency</span> — Apple
              rejects icons that have transparent areas or rounded corners (the stores round
              the corners for you). Uploading again replaces the current icon.
            </Step>
            <Step n={3} title="Pick your accent colour">
              Use the colour picker (or paste a hex code like{" "}
              <span className="font-mono text-xs text-grey-90">#F26522</span>) to set the
              colour used for buttons, highlights and the app header. It defaults to your
              store accent.
            </Step>
            <Step n={4} title="Save and preview">
              Click <span className="font-medium text-grey-90">Save branding</span>. The
              live phone preview on the right shows exactly how your app will look — check it
              before you publish.
            </Step>
          </ol>
        </SectionCard>

        {/* Google Play */}
        <SectionCard
          title="2. Publish on Google Play (Android)"
          description="Android is the simpler of the two stores — you can do this yourself."
          icon={RocketLaunch}
        >
          <ol className="space-y-5">
            <Step n={1} title="Create a Google Play Console account">
              Go to the{" "}
              <span className="font-medium text-grey-90">Google Play Console</span> and sign
              up as a developer. Google charges a{" "}
              <span className="font-medium text-grey-90">$25 one-time</span> registration fee
              (paid to Google, not to us). Approval usually takes a day or two.
            </Step>
            <Step n={2} title="Request and download your app build">
              On the Mobile App page, use{" "}
              <span className="font-medium text-grey-90">Request your app build</span>. When
              it&apos;s ready, download the file we prepare (an{" "}
              <span className="font-mono text-xs text-grey-90">.aab</span> or{" "}
              <span className="font-mono text-xs text-grey-90">.apk</span>).
            </Step>
            <Step n={3} title="Create the app in the Play Console">
              Click <span className="font-medium text-grey-90">Create app</span>, enter your
              app name, choose your default language, and mark it as an{" "}
              <span className="font-medium text-grey-90">App</span> that is{" "}
              <span className="font-medium text-grey-90">Free</span>.
            </Step>
            <Step n={4} title="Upload your app file">
              Under <span className="font-medium text-grey-90">Production &rarr; Create new
              release</span>, upload the <span className="font-mono text-xs text-grey-90">.aab
              </span>/<span className="font-mono text-xs text-grey-90">.apk</span> you
              downloaded, then add short release notes.
            </Step>
            <Step n={5} title="Fill in the store listing">
              Add everything shoppers will see:
              <ul className="mt-2 space-y-1.5">
                {[
                  "App icon (512×512) and a feature graphic (1024×500)",
                  "Phone screenshots (at least 2)",
                  "A short description (up to 80 characters) and a full description",
                  "App category and a contact email",
                  "A link to your privacy policy",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-grey-60">
                    <CheckCircleSolid className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </Step>
            <Step n={6} title="Complete the content rating">
              Fill out Google&apos;s short content-rating questionnaire and the data-safety
              form. These are quick and required before you can publish.
            </Step>
            <Step n={7} title="Submit for review">
              Send the release for review. Google typically takes{" "}
              <span className="font-medium text-grey-90">a few days</span> for a first
              submission. Once approved, your app goes live on the Play Store.
            </Step>
          </ol>
          <div className="mt-5">
            <Note>
              Tip: keep your icon, screenshots and description consistent with your website —
              a matching look builds trust and improves your store listing&apos;s conversion.
            </Note>
          </div>
        </SectionCard>

        {/* Apple */}
        <SectionCard
          title="3. Publish on the Apple App Store (iOS)"
          description="iOS has a few more requirements than Android."
          icon={Phone}
        >
          <ol className="space-y-5">
            <Step n={1} title="Enrol in the Apple Developer Program">
              Apple charges <span className="font-medium text-grey-90">$99 per year</span>{" "}
              (paid to Apple, not to us) to publish on the App Store.
            </Step>
            <Step n={2} title="You'll need a Mac to build and submit">
              Apple requires a Mac with Xcode to build, sign and upload an iOS app through
              App Store Connect. The listing (icon, screenshots, description, privacy details)
              works much like Google Play.
            </Step>
            <Step n={3} title="Submit for review">
              Apple reviews every app manually — this usually takes a day or two, and their
              guidelines are stricter than Google&apos;s.
            </Step>
          </ol>
          <div className="mt-5">
            <Note tone="success">
              iOS is the fiddly one. Most merchants choose our{" "}
              <span className="font-medium">Play + App Store Launch</span> tier so we handle
              the Mac build, signing and Apple submission for you.
            </Note>
          </div>
        </SectionCard>

        {/* CTA back to done-for-you */}
        <div className="rounded-large border border-brand-200 bg-brand-50/50 p-6">
          <h2 className="text-base font-semibold text-grey-90">
            Don&apos;t want to deal with this?
          </h2>
          <p className="mt-1 text-sm text-grey-60">
            Use our done-for-you publishing. We build, test, upload and set up your store
            listing on Google Play (and Apple, if you choose) — you just approve.
          </p>
          <Link
            href="/dashboard/mobile-app"
            className="mt-4 inline-flex items-center gap-2 rounded-base bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            <RocketLaunch className="h-4 w-4" />
            See done-for-you publishing
          </Link>
        </div>
      </div>
    </div>
  )
}
