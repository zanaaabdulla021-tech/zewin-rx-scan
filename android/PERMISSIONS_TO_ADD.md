# Android setup

Add these lines inside `<manifest>` in `android/app/src/main/AndroidManifest.xml`
(above the `<application>` tag), once you generate the Android project with
`flutter create .`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

`google_mlkit_text_recognition` needs `minSdkVersion 21` or higher — set it
in `android/app/build.gradle`:

```gradle
android {
    defaultConfig {
        minSdkVersion 21
    }
}
```
