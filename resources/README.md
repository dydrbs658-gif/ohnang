# 앱 아이콘 / 스플래시 에셋

`icon.svg` 가 신선고 앱 아이콘 원본이다. 인앱 심볼(`components/BrandLogo.js`)과 동일한 도형을 공유한다.

## 네이티브 아이콘 생성 절차

[@capacitor/assets](https://github.com/ionic-team/capacitor-assets) 는 PNG 입력을 요구하므로 먼저 변환한다.

1. `icon.svg` → `icon.png` (1024×1024) 변환
   - 간단하게는 https://svgtopng.com 또는 Figma/Inkscape 사용
2. 스플래시 원본 제작: `splash.png` (2732×2732, 중앙 심볼 + #1D6AE5 배경), `splash-dark.png` (동일)
3. 생성 실행:
   ```bash
   npm install -D @capacitor/assets
   npx capacitor-assets generate
   ```
4. `npx cap sync` 후 Android Studio / Xcode에서 아이콘 적용 확인

## 컬러 레퍼런스

- 배경: `#1D6AE5` (primary)
- 냉장고 라인: `#FFFFFF`
- 잎사귀: `#6EE7B7`
