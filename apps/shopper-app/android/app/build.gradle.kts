import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// ---------------------------------------------------------------------------
// Firebase (FCM) — CONDITIONAL.
//
// The Google Services Gradle plugin is applied ONLY when a real
// android/app/google-services.json is present. This is the critical guarantee
// that a store WITHOUT push configured still builds a release APK: with no
// google-services.json the plugin never runs, Firebase.initializeApp() has no
// default options and throws, and the Dart side degrades to disabled-push
// (see lib/core/notifications/push_service.dart + PUSH_SETUP.md).
// Drop the file in and push turns on with zero further Gradle/Dart changes.
// ---------------------------------------------------------------------------
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
    logger.lifecycle("google-services.json found — FCM push enabled")
} else {
    logger.lifecycle("no google-services.json — building WITHOUT Firebase/push")
}

// ---------------------------------------------------------------------------
// White-label per-store stamping.
//
// applicationId + app label are overridable at BUILD time so ONE codebase can
// produce a distinct branded binary per store. The factory (scripts/build_store.sh)
// passes these as Gradle project properties via ORG_GRADLE_PROJECT_* env vars:
//   ORG_GRADLE_PROJECT_storeAppId=ai.mautomate.shopper.dearwish
//   ORG_GRADLE_PROJECT_storeAppLabel="Dear Wish"
// A plain `flutter build` (no overrides) falls back to the mAutomate defaults,
// so bare builds still work.
// ---------------------------------------------------------------------------
val storeAppId = (project.findProperty("storeAppId") as String?)
    ?: "ai.mautomate.mautomate_shopper"
val storeAppLabel = (project.findProperty("storeAppLabel") as String?)
    ?: "mAutomate Shopper"

// Deep links (stamped by the factory per store; safe defaults for bare builds).
//   storeDeepLinkHost   -> the store's own domain for verified Android App Links
//                          (e.g. dearwish.shop). Defaults to a placeholder host
//                          so the manifest stays valid; autoVerify simply fails
//                          for that placeholder and the custom scheme still works.
//   storeDeepLinkScheme -> the custom URL scheme (e.g. "mautomate" globally, or a
//                          per-store scheme). Custom-scheme links need no domain
//                          verification, so they always work.
val storeDeepLinkHost = (project.findProperty("storeDeepLinkHost") as String?)
    ?: "app.invalid"
val storeDeepLinkScheme = (project.findProperty("storeDeepLinkScheme") as String?)
    ?: "mautomate"

// Release signing (parity with the merchant app): if android/key.properties
// exists it is used for a real release signature; otherwise we fall back to the
// debug keystore so `flutter build apk --release` still works locally / in CI.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

android {
    namespace = "ai.mautomate.mautomate_shopper"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        // Required by flutter_local_notifications (uses java.time APIs on older
        // Android). Backports them so the app runs on all supported API levels.
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // Per-store package name (stamped by the factory; default for bare builds).
        applicationId = storeAppId
        // Per-store launcher label, consumed by AndroidManifest's ${appLabel}.
        manifestPlaceholders["appLabel"] = storeAppLabel
        // Deep-link host + scheme, consumed by AndroidManifest intent-filters.
        manifestPlaceholders["deepLinkHost"] = storeDeepLinkHost
        manifestPlaceholders["deepLinkScheme"] = storeDeepLinkScheme
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = (keystoreProperties["storeFile"] as String?)?.let { file(it) }
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (keystorePropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                // Debug keys so an unsigned release build still runs; a real
                // store build drops android/key.properties in first.
                signingConfigs.getByName("debug")
            }
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    // Backports java.time (and other) APIs required by
    // flutter_local_notifications when running on older Android versions.
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
