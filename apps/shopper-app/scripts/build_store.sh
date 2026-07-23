#!/usr/bin/env bash
#
# build_store.sh — the white-label factory.
#
# Turns the ONE mAutomate shopper codebase into a branded per-store binary.
# Reads stores/<slug>.json and stamps, at BUILD time:
#   - Android applicationId + launcher label   (Gradle project properties)
#   - iOS bundle id + display name             (best-effort; real IPA needs macOS)
#   - the launcher icon                        (flutter_launcher_icons, per-store)
#   - the store binding                        (--dart-define from dartDefines)
#
# Colors/theme are runtime-dynamic from the store's CMS payload, so they are NOT
# baked here — only the four things above are build-time.
#
# Usage:
#   scripts/build_store.sh <slug> [target]
#     <slug>    store config name (stores/<slug>.json), e.g. dear-wish
#     [target]  apk (default) | appbundle | aab | ios
#
# Examples:
#   scripts/build_store.sh dear-wish            # release APK
#   scripts/build_store.sh dear-wish appbundle  # Play Store .aab
#   scripts/build_store.sh dear-wish ios        # prints the macOS IPA steps
#
# The script is IDEMPOTENT: every file it mutates (mipmaps, iOS icons, Info.plist,
# project.pbxproj, the per-store icon config) is backed up and restored on exit,
# so a build never pollutes the working tree / git.
#
set -euo pipefail

# --- locate ourselves relative to the app root -----------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$APP_ROOT"

# --- args ------------------------------------------------------------------
SLUG="${1:-}"
TARGET="${2:-apk}"
if [[ -z "$SLUG" ]]; then
  echo "usage: scripts/build_store.sh <slug> [apk|appbundle|aab|ios]" >&2
  echo "available stores:" >&2
  ls stores/*.json 2>/dev/null | sed 's#stores/##;s#\.json##;s/^/  - /' | grep -v '_TEMPLATE' >&2 || true
  exit 2
fi

CONFIG="stores/${SLUG}.json"
if [[ ! -f "$CONFIG" ]]; then
  echo "error: no such store config: $CONFIG" >&2
  exit 2
fi

command -v flutter >/dev/null 2>&1 || { echo "error: flutter not on PATH" >&2; exit 127; }
command -v python3 >/dev/null 2>&1 || { echo "error: python3 not on PATH" >&2; exit 127; }

# Preflight: a release build of the native `jni` transitive dep writes its CMake
# output INTO its own package dir under the pub cache. If the pub cache is not
# writable (e.g. root-owned after a sudo install), release builds fail with a
# confusing "hash_key.txt (No such file or directory)". Surface the fix early.
PUB_CACHE_DIR="${PUB_CACHE:-$HOME/.pub-cache}"
if [[ -d "$PUB_CACHE_DIR/hosted/pub.dev" && ! -w "$PUB_CACHE_DIR/hosted/pub.dev" ]]; then
  echo "warn: pub cache '$PUB_CACHE_DIR' is not writable by $(whoami)." >&2
  echo "      Native deps (jni) must write build output there; release builds will fail." >&2
  echo "      Fix once:  sudo chown -R \$USER '$PUB_CACHE_DIR'" >&2
  echo "      or:        export PUB_CACHE=<writable dir> && flutter pub get   (then re-run)" >&2
fi

echo "==> mAutomate white-label factory"
echo "    store  : $SLUG"
echo "    config : $CONFIG"
echo "    target : $TARGET"

# --- parse the store JSON into shell vars ----------------------------------
# python emits shell-quoted assignments; DART_DEFINES becomes a bash array.
eval "$(python3 - "$CONFIG" <<'PY'
import json, sys, shlex
cfg = json.load(open(sys.argv[1]))

def req(key):
    v = cfg.get(key)
    if not v or not str(v).strip():
        sys.stderr.write(f"error: '{key}' is required in the store config\n")
        sys.exit(3)
    return str(v)

app_name  = req("appName")
android_id = req("androidApplicationId")
ios_id    = cfg.get("iosBundleId") or android_id
accent    = cfg.get("accentColor") or ""
icon      = cfg.get("iconPath") or ""

defines = cfg.get("dartDefines") or {}
parts = []
for k, v in defines.items():
    if k.startswith("$") or k.startswith("$comment"):
        continue
    parts.append("--dart-define=%s=%s" % (k, v))

# minimal sanity: the publishable key is what actually binds the store
if not defines.get("STORE_PUBLISHABLE_KEY"):
    sys.stderr.write("warn: dartDefines.STORE_PUBLISHABLE_KEY is empty — the build will not be store-scoped\n")

print("APP_NAME=%s"       % shlex.quote(app_name))
print("ANDROID_APP_ID=%s" % shlex.quote(android_id))
print("IOS_BUNDLE_ID=%s"  % shlex.quote(ios_id))
print("ACCENT=%s"         % shlex.quote(accent))
print("ICON_PATH=%s"      % shlex.quote(icon))
import urllib.parse as _urlparse
_cms = (defines.get("CMS_BASE") or "").strip()
app_link_host = (cfg.get("androidAppLinkHost") or "").strip()
if not app_link_host and _cms:
    app_link_host = _urlparse.urlparse(_cms).netloc or ""
deep_scheme = (cfg.get("deepLinkScheme") or "mautomate").strip()
print("APP_LINK_HOST=%s"    % shlex.quote(app_link_host))
print("DEEP_LINK_SCHEME=%s" % shlex.quote(deep_scheme))
print("DART_DEFINES=(%s)" % " ".join(shlex.quote(p) for p in parts))
PY
)"

echo "    appName             : $APP_NAME"
echo "    androidApplicationId: $ANDROID_APP_ID"
echo "    iosBundleId         : $IOS_BUNDLE_ID"
echo "    icon                : ${ICON_PATH:-<default mAutomate>}"
echo "    dart-defines        : ${#DART_DEFINES[@]}"

# --- idempotency: back up everything we touch, restore on exit --------------
BACKUP_DIR="$(mktemp -d)"
GEN_ICON_CFG="flutter_launcher_icons_${SLUG}.yaml"   # gitignored, removed on exit

restore() {
  # restore mutated files/dirs from backup, if we saved them
  [[ -e "$BACKUP_DIR/mipmaps" ]] && {
    rm -rf android/app/src/main/res/mipmap-*
    cp -a "$BACKUP_DIR/mipmaps/." android/app/src/main/res/ 2>/dev/null || true
  }
  [[ -e "$BACKUP_DIR/AppIcon.appiconset" ]] && {
    rm -rf ios/Runner/Assets.xcassets/AppIcon.appiconset
    cp -a "$BACKUP_DIR/AppIcon.appiconset" ios/Runner/Assets.xcassets/AppIcon.appiconset
  }
  [[ -e "$BACKUP_DIR/Info.plist" ]] && cp -a "$BACKUP_DIR/Info.plist" ios/Runner/Info.plist
  [[ -e "$BACKUP_DIR/project.pbxproj" ]] && cp -a "$BACKUP_DIR/project.pbxproj" ios/Runner.xcodeproj/project.pbxproj
  rm -f "$GEN_ICON_CFG"
  rm -rf "$BACKUP_DIR"
}
trap restore EXIT

backup_android_icons() {
  mkdir -p "$BACKUP_DIR/mipmaps"
  cp -a android/app/src/main/res/mipmap-* "$BACKUP_DIR/mipmaps/" 2>/dev/null || true
}
backup_ios() {
  cp -a ios/Runner/Assets.xcassets/AppIcon.appiconset "$BACKUP_DIR/AppIcon.appiconset" 2>/dev/null || true
  cp -a ios/Runner/Info.plist "$BACKUP_DIR/Info.plist" 2>/dev/null || true
  cp -a ios/Runner.xcodeproj/project.pbxproj "$BACKUP_DIR/project.pbxproj" 2>/dev/null || true
}

# --- generate the per-store launcher icon ----------------------------------
generate_icons() {
  local platforms="$1"   # "android", "ios", or "android,ios"
  if [[ -z "$ICON_PATH" ]]; then
    echo "==> no iconPath in config — keeping the default mAutomate launcher icon"
    return 0
  fi
  if [[ ! -f "$ICON_PATH" ]]; then
    echo "warn: iconPath '$ICON_PATH' not found — keeping the default mAutomate icon" >&2
    return 0
  fi
  echo "==> generating launcher icon from $ICON_PATH ($platforms)"
  local do_android=false do_ios=false
  [[ "$platforms" == *android* ]] && do_android=true
  [[ "$platforms" == *ios* ]] && do_ios=true

  cat > "$GEN_ICON_CFG" <<YAML
flutter_launcher_icons:
  android: $do_android
  ios: $do_ios
  image_path: "$ICON_PATH"
  remove_alpha_ios: true
YAML
  dart run flutter_launcher_icons -f "$GEN_ICON_CFG"
}

# --- iOS best-effort stamping (display name + bundle id) --------------------
stamp_ios_metadata() {
  echo "==> stamping iOS display name + bundle id (best-effort)"
  # CFBundleDisplayName -> appName
  python3 - "$APP_NAME" <<'PY'
import re, sys
name = sys.argv[1]
p = "ios/Runner/Info.plist"
s = open(p).read()
s = re.sub(r"(<key>CFBundleDisplayName</key>\s*<string>)(.*?)(</string>)",
           lambda m: m.group(1) + name + m.group(3), s, count=1, flags=re.S)
open(p, "w").write(s)
PY
  # PRODUCT_BUNDLE_IDENTIFIER -> iosBundleId (skip the *.RunnerTests targets)
  python3 - "$IOS_BUNDLE_ID" <<'PY'
import re, sys
bid = sys.argv[1]
p = "ios/Runner.xcodeproj/project.pbxproj"
s = open(p).read()
def repl(m):
    val = m.group(2)
    if val.endswith(".RunnerTests"):
        return m.group(0)
    return m.group(1) + bid + ";"
s = re.sub(r"(PRODUCT_BUNDLE_IDENTIFIER = )([^;]+);", repl, s)
open(p, "w").write(s)
PY
}

# --- build -----------------------------------------------------------------
DIST_DIR="dist/${SLUG}"
mkdir -p "$DIST_DIR"

export ORG_GRADLE_PROJECT_storeAppId="$ANDROID_APP_ID"
export ORG_GRADLE_PROJECT_storeAppLabel="$APP_NAME"
# Deep-link host (verified Android App Links) derived from the store's own
# domain (CMS_BASE), and the custom URL scheme. Without these the manifest
# falls back to the app.invalid placeholder and only the custom scheme works.
if [ -n "${APP_LINK_HOST:-}" ]; then
  export ORG_GRADLE_PROJECT_storeDeepLinkHost="$APP_LINK_HOST"
  echo "    deepLinkHost : $APP_LINK_HOST"
else
  echo "    deepLinkHost : (none — CMS_BASE has no host; App Links disabled, custom scheme still works)"
fi
export ORG_GRADLE_PROJECT_storeDeepLinkScheme="${DEEP_LINK_SCHEME:-mautomate}"

case "$TARGET" in
  apk)
    backup_android_icons
    generate_icons "android"
    echo "==> flutter build apk --release"
    flutter build apk --release "${DART_DEFINES[@]}"
    OUT="build/app/outputs/flutter-apk/app-release.apk"
    DEST="$DIST_DIR/${SLUG}-release.apk"
    ;;
  appbundle|aab)
    backup_android_icons
    generate_icons "android"
    echo "==> flutter build appbundle --release"
    flutter build appbundle --release "${DART_DEFINES[@]}"
    OUT="build/app/outputs/bundle/release/app-release.aab"
    DEST="$DIST_DIR/${SLUG}-release.aab"
    ;;
  ios)
    backup_ios
    generate_icons "ios"
    stamp_ios_metadata
    cat <<EOS

==> iOS build requires macOS + Xcode + Apple signing certificates.
    This host cannot produce a signed .ipa. The iOS icon + Info.plist +
    bundle id have been stamped for you; on a Mac, run:

      cd apps/shopper-app
      flutter build ipa --release \\
        ${DART_DEFINES[*]}

    Then open build/ios/archive/Runner.xcarchive in Xcode > Distribute App,
    signing with the MERCHANT's own Apple Developer account (see WHITE_LABEL.md).
    Bundle id to select/create in App Store Connect: $IOS_BUNDLE_ID

EOS
    exit 0
    ;;
  *)
    echo "error: unknown target '$TARGET' (use apk | appbundle | aab | ios)" >&2
    exit 2
    ;;
esac

# --- collect the artifact ---------------------------------------------------
if [[ ! -f "$OUT" ]]; then
  echo "error: expected build output not found: $OUT" >&2
  exit 1
fi
cp -f "$OUT" "$DEST"
SIZE="$(du -h "$DEST" | cut -f1)"

echo ""
echo "==> BUILD OK"
echo "    store        : $APP_NAME ($SLUG)"
echo "    applicationId: $ANDROID_APP_ID"
echo "    label        : $APP_NAME"
echo "    artifact     : $APP_ROOT/$DEST  ($SIZE)"
echo ""
echo "    Verify the stamped identity with:"
echo "      aapt dump badging \"$DEST\" | grep -E 'package|application-label'"
