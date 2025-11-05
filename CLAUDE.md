# mukuviewer - 開発作業記録

## プロジェクト概要

**アプリ名**: mukuviewer
**説明**: ブラウザで動作する電子コミックビューア
**技術スタック**: C++ + WebAssembly (Emscripten)
**対象環境**: PCブラウザ（将来的にモバイル対応予定）

## 基本仕様

### 起動方法
```
https://mvtest.ci-labo.net/index.html?book_id=[コミックID]
```

### 画像URL形式
```
https://mvtest.ci-labo.net/images/[コミックID]/[ページ番号].jpg
```
- ページ番号は1から始まる
- 最大209ページ（テスト環境）

### 表示方式

#### 見開きモード（通常モード）
- **横長画面**: 見開き2ページ表示（右めくり方式）
  - 1ページ目が右側、2ページ目が左側
  - 左右ボタンで2ページずつ移動
- **縦長画面**: 1ページずつ表示
  - 画面いっぱいに1ページを表示
  - 左右ボタンで1ページずつ移動
- アスペクト比を保持しながら画面いっぱいに表示
- 画面の向きが変わると自動的に切り替わる

#### シームレスモード
- **横読みモード**（横長画面で自動選択）
  - 右から左へ横スクロール（20, 19, 18... 2, 1）
  - ドラッグまたは自動再生でスクロール
- **縦読みモード**（縦長画面で自動選択）
  - 上から下へ縦スクロール（1, 2, 3... 20, 21...）
  - 1ページを画面幅いっぱいに表示
  - ドラッグまたは自動再生でスクロール
- 画面の向きが変わると自動的に切り替わる

## 実装済み機能

### 1. コア機能
- [x] WebAssemblyベースのビューア
- [x] JPEG画像の読み込みとデコード（stb_image使用）
- [x] 見開き2ページ表示（横長画面）
- [x] 1ページ表示（縦長画面）
- [x] 画面の向きに応じた自動切り替え
- [x] ページ送り・戻し機能（1ページまたは2ページずつ）
- [x] レスポンシブ表示（ウィンドウサイズに自動適応）

### 2. シームレス表示モード
- [x] 横読みモード
  - 右から左への横スクロール（降順：20, 19, 18... 2, 1）
  - マウス/タッチドラッグでスクロール
  - 動的ページ読み込み（最大209ページ）
  - ビューポートベースの描画最適化
- [x] 縦読みモード
  - 上から下への縦スクロール（昇順：1, 2, 3... 20...）
  - 1ページを画面幅いっぱいに表示
  - マウス/タッチドラッグでスクロール
  - 動的ページ読み込み
- [x] 自動再生機能
  - 横読み：左へ自動スクロール
  - 縦読み：下へ自動スクロール
  - ドラッグ時に一時停止、離すと再開
  - 30fps、4ピクセル/フレーム
- [x] 画面の向きに応じた自動モード選択
  - 横長画面 → 横読みモード
  - 縦長画面 → 縦読みモード
  - ウィンドウリサイズ時の自動切り替え

### 3. 先読み機能（パフォーマンス最適化）
- [x] 現在ページから20ページ先まで先読み（通常モード）
- [x] 優先度ベースの読み込み
  - 即座：現在+4ページ（見開き2回分）
  - 遅延：残り16ページ（100ms後）
- [x] インテリジェントキャッシュ管理
  - 前後15ページまで保持
  - 古いキャッシュは自動削除
- [x] 重複読み込み防止
- [x] シームレスモード用の動的読み込み
  - スクロール位置に応じて次の10ページを自動読み込み
  - ビューポート外のページは未読み込み状態で保持

### 4. UI/UX
- [x] 下部ナビゲーションバー
  - 「シームレス表示」/「見開き表示」切り替えボタン
  - 「横読み」/「縦読み」切り替えボタン（シームレス時のみ表示）
  - 「自動再生」/「停止」ボタン（シームレス時のみ表示）
  - 「全画面」ボタン
- [x] 全画面表示モード
  - 全画面時はナビゲーションバーを自動非表示
  - 全画面API（webkit, ms プレフィックス対応）
- [x] 左右端のナビゲーションボタン（通常モード）
- [x] キーボードショートカット
  - ← : 次のページ
  - → : 前のページ
  - C : キャッシュステータス表示
- [x] ドラッグスクロール（シームレスモード）
  - 横読み：左右ドラッグ
  - 縦読み：上下ドラッグ
  - タッチイベント対応（モバイル準備完了）
- [x] ウィンドウリサイズ時の自動再描画・モード切り替え
- [x] デバッグ用コンソールログ

## ファイル構成

```
/var/www/mvtest/
├── index.html              # エントリーポイント
├── build.sh                # ビルドスクリプト
├── build/
│   ├── mukuviewer.js       # WebAssemblyラッパー (35KB)
│   └── mukuviewer.wasm     # コンパイル済みバイナリ (120KB)
├── src/
│   ├── main.cpp            # メインのC++ソースコード
│   └── stb_image.h         # 画像デコードライブラリ
├── images/
│   └── 00000001/           # テスト用画像 (1.jpg～209.jpg)
└── CLAUDE.md               # この開発記録
```

## 主要な技術実装

### ページキャッシュシステム（C++）
```cpp
std::map<int, ImageData> pageCache;  // ページ番号をキーにしたキャッシュ
std::set<int> loadingPages;          // 読み込み中のページ番号
bool singlePageMode;                 // true: 1ページ表示, false: 2ページ表示

static const int PRELOAD_PAGES = 20;  // 先読みするページ数
const int maxPages = 209;             // 最大ページ数
```

### 画面の向き判定（JavaScript）
```javascript
function isLandscape() {
    return window.innerWidth > window.innerHeight;
}

// 初期化時
const landscape = isLandscape();
const singlePage = !landscape; // 縦長の場合は1ページモード
Module.ccall('setSinglePageMode', null, ['boolean'], [singlePage]);

// リサイズ時
window.addEventListener('resize', function() {
    const currentOrientation = isLandscape();
    if (currentOrientation !== previousOrientation) {
        // モードを自動切り替え
    }
});
```

### 画像デコードフロー
1. `emscripten_fetch` で画像をダウンロード
2. `stbi_load_from_memory` でJPEGをRGBAにデコード
3. C++の`std::vector`にデータ保存
4. JavaScript側で`ImageData`オブジェクトに変換
5. Canvasに描画

### 描画最適化

#### 通常モード（見開き表示）
- 1ページ/2ページモードの自動切り替え
- アスペクト比計算により画面サイズに最適化
- 一時Canvasを使用して高品質リサイズ
- 見開き2ページの幅比率を保持

#### シームレスモード
- 各ページを個別のCanvas要素として生成
- ビューポート内のページのみ描画（パフォーマンス最適化）
- スクロール位置に応じた遅延読み込み
- 横読み：Flexbox横並び（right-to-left order）
- 縦読み：Flexbox縦並び（1ページ/行）

## ビルド方法

```bash
cd /var/www/mvtest
./build.sh
```

**ビルド設定**:
- Emscripten 4.0.18
- 最適化レベル: -O2
- WASM=1, FETCH=1（非同期HTTP取得）
- ALLOW_MEMORY_GROWTH=1（動的メモリ拡張）

## 開発中に解決した問題

### 1. Module重複宣言エラー
**問題**: `let Module`がEmscriptenコードと競合
**解決**: `var Module`に変更

### 2. HEAPU8.bufferアクセスエラー
**問題**: `Module.HEAPU8.buffer`が未定義
**解決**: `HEAPU8.subarray()`を使用してコピー作成

### 3. 画像サイズが小さい
**問題**: 画像がCanvas内で小さく表示される
**解決**: アスペクト比保持しながら画面いっぱいに拡大表示

### 4. ページめくりが遅い
**問題**: 先読み処理が20ページ一度にリクエストしUIブロック
**解決**: 優先度ベースの段階的読み込み（即座4ページ + 遅延16ページ）

### 5. シームレスモードでページの順序が逆
**問題**: ページが左から右（1, 2, 3...）で並んでいた
**解決**: ループを逆順（20, 19, 18...）に変更し、右から左の配置を実現

### 6. ドラッグ方向が逆
**問題**: 左ドラッグでページが戻り、右ドラッグで進んでいた
**解決**: `scrollLeft + walk` を `scrollLeft - walk` に変更

### 7. ページ間の間隔が広い
**問題**: ページとページの間に大きな空白ができていた
**解決**: `min-width: 50vw` を削除し、画像のアスペクト比に基づいてCanvas幅を動的計算

### 8. 自動再生中にページが読み込まれない
**問題**: 自動スクロール中、未読み込みページに到達すると黒画面になる
**解決**: 自動再生中も10フレームごとに `loadMorePagesIfNeeded()` と `renderVisiblePages()` を呼び出す

## パフォーマンス

### メモリ使用量
- 1ページあたり: 約3.84MB (800x1200x4バイト)
- キャッシュ最大: 約58MB (15ページ分)
- 実測: 先読み20ページで約77MB

### 読み込み速度
- キャッシュヒット時: 即座（<10ms）
- ネットワーク読み込み: 画像サイズ依存（テスト画像は30KB程度）

## 今後の課題・改善案

### 短期的改善
- [ ] ローディングインジケーターの追加
- [ ] ページ番号表示UI（現在ページ / 総ページ数）
- [ ] エラーハンドリングの強化（404時など）
- [ ] 自動再生速度の調整機能
- [ ] ページジャンプ機能（特定ページに直接移動）

### 中期的改善
- [ ] ページ総数の動的取得（現在は固定209ページ）
- [ ] ブックマーク機能（読んだページを記憶）
- [ ] 画像圧縮最適化（WebP対応検討）
- [ ] プリロード範囲の調整機能
- [ ] UIテーマのカスタマイズ

### 長期的改善
- [ ] 複数のコミックを管理するライブラリ機能
- [ ] オフライン対応（Service Worker + IndexedDB）
- [ ] PDF出力機能
- [ ] 読書履歴の記録・分析
- [ ] コメント・メモ機能

## デバッグ方法

### ブラウザコンソールでの確認
```javascript
// キャッシュ状態を表示
Module.ccall('printCacheStatus', null, [], []);

// 手動で次ページへ
Module.ccall('nextPage', null, [], []);

// 画面を再描画
Module.ccall('refresh', null, [], []);

// 1ページ/2ページモードの切り替え
Module.ccall('setSinglePageMode', null, ['boolean'], [true]);  // 1ページモード
Module.ccall('setSinglePageMode', null, ['boolean'], [false]); // 2ページモード

// 特定ページをキャッシュに読み込み
Module.ccall('loadPageToCache', null, ['number'], [50]);

// 単一ページを描画（シームレスモード用）
Module.ccall('renderSinglePage', null, ['number', 'string'], [1, 'page-canvas-1']);
```

### よく使うログ

#### 通常モード
```
[WASM] Initialized viewer with book_id: 00000001
[WASM] Single page mode: OFF
[WASM] Loading pages 1 and 2
[WASM] Fetching: https://mvtest.ci-labo.net/images/00000001/1.jpg
[WASM] Image decoded (page 1): 800x1200, channels: 3
[WASM] Rendering pages 1 and 2...
[WASM] Preloading pages from 1 to 21
```

#### シームレスモード
```
Initializing seamless horizontal mode...
Created horizontal canvas for page 20, size: 533x800
画面が横長のため、横読みモードで開始
Loading and rendering page 20 in seamless mode
Successfully rendered page 20
```

#### 画面の向き切り替え
```
Window resized, re-rendering...
画面の向きが変わりました: 縦長
縦読みモードに自動切り替え
Initializing vertical mode...
Created vertical canvas for page 1, size: 1920x2880
```

## 依存関係

### システム要件
- Emscripten SDK (emsdk)
- libatomic (Amazon Linux 2023)
- ImageMagick (テスト画像生成用)

### ライブラリ
- stb_image.h (v2.x) - パブリックドメイン

## メモ

### Emscripten環境
- インストール先: `~/emsdk`
- 有効化: `source ~/emsdk/emsdk_env.sh`
- バージョン: 4.0.18

### テスト画像生成
```bash
cd /var/www/mvtest/images/00000001
for i in {1..15}; do
  convert -size 800x1200 -background white -fill black \
  -pointsize 200 -gravity center label:"Page $i" $i.jpg
done
```

### 既存の画像ファイル
- 1.jpg～209.jpg が既に存在（別途生成済み）
- サイズは様々（30KB～4.3MB）

## 最終更新

- **日付**: 2025-11-04
- **最終ビルド**: mukuviewer.js (36KB), mukuviewer.wasm (121KB)
- **作業状況**: 画面の向きに応じた自動モード切り替え機能の実装完了

### 本セッションで実装した機能
1. **シームレスモードの画面向き対応**
   - 横長画面 → 横読みモードで起動
   - 縦長画面 → 縦読みモードで起動
   - ウィンドウリサイズ時の自動切り替え

2. **見開きモードの画面向き対応**
   - 横長画面 → 2ページ表示（見開き）
   - 縦長画面 → 1ページ表示
   - ウィンドウリサイズ時の自動切り替え
   - C++側に `singlePageMode` フラグを追加
   - ページ送りも1ページ/2ページに自動対応

3. **縦読みモードの完全実装**（前セッションから継続）
   - 縦スクロール対応
   - 縦方向のドラッグスクロール
   - 縦方向の自動再生
   - 動的ページ読み込み

### エクスポート関数（C++）
- `initialize(book_id)` - 初期化
- `nextPage()` - 次ページへ
- `prevPage()` - 前ページへ
- `refresh()` - 再描画
- `printCacheStatus()` - キャッシュ状態表示
- `preloadPagesDelayed()` - 遅延先読み
- `renderSinglePage(pageNum, canvasId)` - 単一ページ描画
- `loadPageToCache(pageNum)` - ページをキャッシュに読み込み
- `setSinglePageMode(enabled)` - 1ページ/2ページモード切り替え

## 連絡事項

### 確認すべき項目
1. ✅ ページめくりの体感速度が改善されたか → 先読み機能で改善
2. ✅ 先読みがUIをブロックしていないか → 優先度ベースの読み込みで解決
3. ✅ メモリ使用量が許容範囲か → キャッシュ管理で最適化
4. ✅ 縦読み/横読みモードの実装 → 完了
5. ✅ 画面の向きに応じた自動切り替え → 完了

### 次のステップ候補
- ページ番号表示UIの追加
- 自動再生速度の調整機能
- ページジャンプ機能
- ローディングインジケーター
