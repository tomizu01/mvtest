# mukuviewer - 開発作業記録

## プロジェクト概要

**アプリ名**: mukuviewer
**説明**: ブラウザで動作する電子コミックビューア
**技術スタック**: C++ + WebAssembly (Emscripten)
**対象環境**: PCブラウザ、モバイルブラウザ（レスポンシブ対応）

## 基本仕様

### 起動方法
```
https://mvtest.ci-labo.net/index.html?book_id=[コミックID]
```

### 画像URL形式
```
https://mvtest.ci-labo.net/images/[コミックID]/[ページ番号].jpg.enc
```
- ページ番号は1から始まる
- 最大20ページ（デモ版）
- 画像はAES-128で暗号化されており、`.enc`拡張子で提供される
- ダウンロード後、C++側で自動的に復号化される

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
  - 上から下へ縦スクロール（1, 2, 3... 18, 19, 20）
  - 1ページを画面幅いっぱいに表示
  - ドラッグまたは自動再生でスクロール
- 画面の向きが変わると自動的に切り替わる

## 実装済み機能

### 1. コア機能
- [x] WebAssemblyベースのビューア
- [x] JPEG画像の読み込みとデコード（stb_image使用）
- [x] 暗号化画像の復号化対応（AES-128）
  - 画像ダウンロード後、自動的に復号化処理を実行
  - 暗号化キー: `"1234567890123456"`（16バイト固定）
  - PKCS#7パディング方式を使用
- [x] 見開き2ページ表示（横長画面）
- [x] 1ページ表示（縦長画面）
- [x] 画面の向きに応じた自動切り替え
- [x] ページ送り・戻し機能（1ページまたは2ページずつ）
- [x] レスポンシブ表示（ウィンドウサイズに自動適応）
- [x] 高DPI画面対応（Retina、高解像度モバイルディスプレイ）
  - devicePixelRatio考慮した描画バッファサイズ設定
  - iPhone/iPad（dpr=2〜3）、Android（dpr=2〜4）で鮮明な表示
  - Canvas描画バッファ = 論理サイズ × devicePixelRatio
  - imageSmoothingQuality = 'high'による高品質補間
  - モアレ（干渉縞）の大幅な軽減

### 2. シームレス表示モード
- [x] 横読みモード
  - 右から左への横スクロール（降順：20, 19, 18... 2, 1）
  - マウス/タッチドラッグでスクロール
  - 動的ページ読み込み（最大20ページ）
  - ビューポートベースの描画最適化
- [x] 縦読みモード
  - 上から下への縦スクロール（昇順：1, 2, 3... 18, 19, 20）
  - 1ページを画面幅いっぱいに表示
  - マウス/タッチドラッグでスクロール
  - 動的ページ読み込み（最大20ページ）
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
- [x] スプラッシュ画面
  - ロゴ画像（public/images/mukuviewer.png）を中央に表示
  - 白背景、パルスアニメーション（拡大縮小）
  - 初期化完了後0.5秒待機してフェードアウト（0.8秒）
- [x] サブメニュー（画面右上、シームレス時のみ表示）
  - サブメニューオープンボタン（submenu_open.png）
  - ポップアップメニュー（白背景、角丸デザイン）
    - ズームセクション：縮小・標準・拡大（横並び、アイコン付き）
    - 読み方向セクション：縦読み・横読み（横並び、アイコン付き）
  - 選択中のボタンは青色（#396BD6）で強調
  - サブメニュー外をクリックで自動的に閉じる
- [x] 自動再生ボタン（画面左下、シームレス時のみ表示）
  - 黒背景・白文字の角丸ボタン
  - アイコン付き（play_start.png / play_stop.png）
  - 「自動再生」⇔「再生中」テキスト切り替え
- [x] モード切り替えボタン（画面右下）
  - 白い角丸コンテナに2つのボタンを横並び配置
  - シームレス/見開き表示を画像ボタンで切り替え
  - active/inactive状態で画像が自動切り替え
- [x] 全画面表示ボタン（画面右下右端、PC版のみ）
  - アイコンのみ表示（fullscreen.png / fullscreen_cancel.png）
  - 全画面状態に応じて自動的にアイコン切り替え
  - モバイルデバイスでは非表示
- [x] 左右端のナビゲーションボタン（見開きモード時）
- [x] キーボードショートカット
  - ← : 次のページ
  - → : 前のページ
  - C : キャッシュステータス表示
- [x] ドラッグスクロール（シームレスモード）
  - 横読み：左右ドラッグ
  - 縦読み：上下ドラッグ
  - タッチイベント対応（モバイル対応済み）
  - 拡大・縮小時は両方向にドラッグスクロール可能
- [x] ウィンドウリサイズ時の自動再描画・モード切り替え
- [x] モバイルデバイス対応
  - デバイス判別機能（User-Agent + タッチ + 画面サイズ）
  - レイアウトの自動調整
- [x] UI要素の自動表示/非表示
  - デフォルトで全てのUI要素を非表示（透明化）
  - 画面タップ/クリックで表示（見開きモード時はページ送りボタン以外）
  - 最後の操作から3秒後に自動的にフェードアウト
  - UI要素上にマウスがある間は非表示にならない
  - 対象UI要素：
    - サブメニューオープンボタン（右上）
    - 自動再生ボタン（左下）
    - モード切り替えボタン（右下中央）
    - 全画面表示ボタン（右下右端）
  - スムーズなフェードイン/アウト（0.3秒、opacity + pointer-events制御）
  - より没入感の高い読書体験を実現
- [x] デバッグ用コンソールログ

### 5. 表示倍率機能（シームレスモード）
- [x] 3段階の表示倍率
  - **縮小表示**: 0.5倍（画像が半分のサイズ）
  - **標準表示**: 1倍（通常サイズ）
  - **拡大表示**: 2倍（2倍のサイズ）
- [x] 縮小表示ボタン
  - シームレスモード時のみ表示
  - クリックで「縮小表示 (0.5倍)」⇔「標準表示 (1倍)」を切り替え
  - 拡大表示がオンの場合は自動的にオフになる
- [x] 拡大表示ボタン
  - シームレスモード時のみ表示
  - クリックで「拡大表示 (2倍)」⇔「標準表示 (1倍)」を切り替え
  - 縮小表示がオンの場合は自動的にオフになる
- [x] 倍率変更時の動作
  - 横読みモード・縦読みモードの両方に対応
  - Canvas要素を動的に再作成してリサイズ
  - スクロール位置を倍率に応じて自動調整
- [x] 縮小表示時の画像配置
  - 横読みモード: 画像を縦方向の中央に配置（align-items: center）
  - 縦読みモード: 通常通り上から配置
- [x] 拡大・縮小時の両方向スクロール
  - 横読みモード + 倍率変更時：横方向と縦方向の両方にスクロール可能
  - 縦読みモード + 倍率変更時：縦方向と横方向の両方にスクロール可能
- [x] スムーズなドラッグスクロール
  - ドラッグ中は scroll-behavior: auto で即座に反映
  - ドラッグ終了時は scroll-behavior: smooth に戻す

### 6. セキュリティ・コンテンツ保護
- [x] 右クリックメニューの無効化
  - `contextmenu`イベントをキャンセルして画像の右クリック保存を防止
  - すべてのページで一律に適用
- [x] ドラッグ&ドロップ保存の防止
  - `dragstart`イベントをキャンセルして画像のドラッグ保存を無効化
- [x] テキスト選択の無効化
  - Canvas要素に`user-select: none`を適用（各ブラウザ対応）
  - Chrome/Safari（-webkit）、Firefox（-moz）、IE/Edge（-ms）に対応
- [x] 暗号化画像の配信
  - サーバー側で`.enc`形式の暗号化画像を配信
  - クライアント側で復号化するため、直接のダウンロードでは閲覧不可
- **注意**: スクリーンショットや開発者ツールからの保存は防げないが、一般ユーザーによる簡単な保存は効果的に防止できる

## ファイル構成

```
/var/www/mvtest/
├── index.html              # エントリーポイント
├── build.sh                # ビルドスクリプト
├── build/
│   ├── mukuviewer.js       # WebAssemblyラッパー (36KB)
│   └── mukuviewer.wasm     # コンパイル済みバイナリ (125KB)
├── src/
│   ├── main.cpp            # メインのC++ソースコード
│   ├── cipher.cpp          # AES-128暗号化/復号化ライブラリ
│   └── stb_image.h         # 画像デコードライブラリ
├── images/
│   └── 00000001/           # テスト用画像 (1.jpg.enc～209.jpg.enc、デモ版では20ページまで利用)
├── public/
│   └── images/
│       ├── mukuviewer.png           # ロゴ画像（スプラッシュ画面用）
│       ├── submenu_open.png         # サブメニューオープンボタン
│       ├── enlarge_on.png           # 拡大ボタン（選択中）
│       ├── enlarge_off.png          # 拡大ボタン（非選択）
│       ├── reduce_on.png            # 縮小ボタン（選択中）
│       ├── reduce_off.png           # 縮小ボタン（非選択）
│       ├── tate_on.png              # 縦読みボタン（選択中）
│       ├── tate_off.png             # 縦読みボタン（非選択）
│       ├── yoko_on.png              # 横読みボタン（選択中）
│       ├── yoko_off.png             # 横読みボタン（非選択）
│       ├── play_start.png           # 自動再生開始アイコン
│       ├── play_stop.png            # 自動再生停止アイコン
│       ├── button_seamless_on.png   # シームレスボタン（選択中）
│       ├── button_seamless_off.png  # シームレスボタン（非選択）
│       ├── button_mihiraki_on.png   # 見開きボタン（選択中）
│       ├── button_mihiraki_off.png  # 見開きボタン（非選択）
│       ├── fullscreen.png           # 全画面表示アイコン
│       └── fullscreen_cancel.png    # 全画面解除アイコン
└── CLAUDE.md               # この開発記録
```

## 主要な技術実装

### ページキャッシュシステム（C++）
```cpp
std::map<int, ImageData> pageCache;  // ページ番号をキーにしたキャッシュ
std::set<int> loadingPages;          // 読み込み中のページ番号
bool singlePageMode;                 // true: 1ページ表示, false: 2ページ表示

static const int PRELOAD_PAGES = 20;  // 先読みするページ数
const int maxPages = 20;              // 最大ページ数（デモ版）
```

### 暗号化/復号化システム（C++ - cipher.cpp）
```cpp
// AES-128暗号化/復号化の実装
uint8_t crypt_key[] = "1234567890123456";  // 16バイト固定キー

// 復号化関数（main.cppから呼び出される）
int invCipher(uint8_t* data, int size);

// 主要なAES-128関数
void invCipher16(uint8_t* data, uint8_t* key);  // 16バイトブロック復号化
void KeyExpansion(uint8_t *key);                // 鍵スケジュール
void invSubBytes(uint8_t* src);                 // S-Box逆変換
void invShiftRows(uint8_t* src);                // 行シフト逆変換
void invMixColumns(uint8_t* src);               // 列混合逆変換
void AddRoundKey(uint8_t* src, uint8_t nRound); // ラウンドキー加算
```

**実装の特徴**:
- AES-128アルゴリズム（128ビット鍵、10ラウンド）
- PKCS#7パディング方式を使用
- 16バイト（128ビット）ブロック暗号
- 暗号化されたデータは、復号化後に元のJPEG形式に戻る
- 復号化はダウンロード直後、画像デコード前に実行される（src/main.cpp:141-142）

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
1. `emscripten_fetch` で暗号化画像（.jpg.enc）をダウンロード
2. `invCipher()` でAES-128復号化を実行してJPEGデータを取得
3. `stbi_load_from_memory` でJPEGをRGBAにデコード
4. C++の`std::vector`にデータ保存
5. JavaScript側で`ImageData`オブジェクトに変換
6. Canvasに描画

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

### 9. 拡大表示時にドラッグスクロールが効かない
**問題**: 拡大表示時にドラッグでスクロールしようとしても画面が動かない
**解決**: `scroll-behavior: smooth` がドラッグと干渉していたため、ドラッグ開始時に `auto` に変更し、ドラッグ終了時に `smooth` に戻す処理を追加

### 10. 変数スコープの競合
**問題**: `setupDragScroll`関数の変数がグローバルスコープになっており、横読み・縦読みモードで競合
**解決**: すべての変数を関数内のローカル変数に変更

### 11. 縮小表示時の画像配置が上寄せになる
**問題**: 縮小表示（0.5倍）にした際、横読みモードで画像が画面上部に寄ってしまい見づらい
**解決**: `#seamless-scroll`に`align-items: center`を追加して縦方向中央に配置

### 12. モバイルブラウザでの画像解像度低下とモアレ発生（2025-11-18）
**問題**: モバイルデバイス（特にスマートフォン）で画像が低解像度になり、モアレ（干渉縞）が発生
**原因**:
- Canvas要素の描画バッファサイズとCSSサイズが同じになっており、`window.devicePixelRatio`を考慮していなかった
- モバイルデバイスのdevicePixelRatioは通常2〜4のため、描画バッファが物理ピクセル数に対して不足
- 引き伸ばされることで画質が劣化しモアレが発生
**解決**:
1. **devicePixelRatio対応の実装**
   - Canvas描画バッファ = 論理サイズ × devicePixelRatio
   - CSSサイズ = 論理サイズ
   - コンテキストをdevicePixelRatioでスケーリング
2. **imageSmoothingQuality = 'high'の設定**
   - 見開きモード（main.cpp）とシームレスモード（index.html）の両方に設定
   - 高品質な画像補間アルゴリズムを使用
3. **CSSのimage-rendering設定**
   - `image-rendering: auto; image-rendering: smooth;`を全Canvas要素に適用

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
- [ ] ページ総数の動的取得（現在は固定20ページ）
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
[WASM] Fetching: https://mvtest.ci-labo.net/images/00000001/1.jpg.enc
[WASM] Fetch success: [暗号化ファイルサイズ] bytes
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
- stb_image.h (v2.x) - パブリックドメイン（画像デコード用）
- cipher.cpp - 自作AES-128暗号化/復号化ライブラリ（暗号化画像対応用）

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
- 1.jpg.enc～209.jpg.enc が既に存在（別途生成済み）
- デモ版では1～20ページのみ利用可能
- サイズは様々（30KB～4.3MB）

## 最終更新

- **日付**: 2025-11-18
- **最終ビルド**: mukuviewer.js (36KB), mukuviewer.wasm (125KB)
- **作業状況**: 高DPI画面対応、画像品質の最適化（モアレ対策）

### 本セッションで実装した機能（2025-11-18）
1. **devicePixelRatio対応（高DPI画面でのモアレ対策）**
   - Canvas描画バッファサイズを物理ピクセルで設定
     - `canvas.width = Math.floor(logicalWidth * devicePixelRatio)`
     - `canvas.height = Math.floor(logicalHeight * devicePixelRatio)`
   - CSSサイズは論理ピクセルで設定
     - `canvas.style.width = logicalWidth + 'px'`
     - `canvas.style.height = logicalHeight + 'px'`
   - コンテキストをdevicePixelRatioでスケーリング
     - `ctx.scale(dpr, dpr)`
   - 実装箇所：
     - `renderPageToCanvas`関数（index.html:797-809）- シームレスモード用
     - `createPageCanvas`関数（index.html:1338-1343）- 横読みCanvas作成
     - `createVerticalPageCanvas`関数（index.html:1375-1380）- 縦読みCanvas作成
     - `recreateHorizontalCanvases`関数（index.html:1873-1881）- 横読みCanvas再作成
     - `recreateVerticalCanvases`関数（index.html:1912-1920）- 縦読みCanvas再作成
   - 効果：iPhone/iPad（dpr=2〜3）、高解像度Android（dpr=2〜4）で鮮明な表示を実現

2. **imageSmoothingQuality = 'high'の設定（モアレ対策）**
   - **見開きモード**（main.cpp:418-419）
     ```javascript
     ctx.imageSmoothingEnabled = true;
     ctx.imageSmoothingQuality = 'high';
     ```
   - **シームレスモード**（index.html:842-843）
     ```javascript
     ctx.imageSmoothingEnabled = true;
     ctx.imageSmoothingQuality = 'high';
     ```
   - 両方のモードで高品質な画像補間アルゴリズムを適用
   - 画像縮小時のモアレ（干渉縞）をほぼ解消

3. **CSSによる画像レンダリング品質の最適化**
   - 全てのCanvas要素（#viewer-canvas、.page-canvas、.vertical-page-canvas）に適用
     ```css
     image-rendering: auto;
     image-rendering: smooth;
     ```
   - ブラウザのスムーズな補間アルゴリズムを明示的に指定

4. **問題の調査と解決**
   - モバイルブラウザでの画像解像度低下とモアレ発生の原因を特定
   - devicePixelRatioを考慮していなかったことが原因
   - 見開きモードで特に顕著だったモアレ問題を解決
   - 元素材の加工ではなく、描画アルゴリズムの改善で対応

### 過去のセッションで実装した機能（2025-11-14）
1. **UIの再設計とメニュー整理**
   - 画面右上にサブメニューオープンボタン（submenu_open.png）を配置
   - サブメニューポップアップに機能を集約
     - 白背景、角丸デザイン
     - ズームセクション：縮小・標準・拡大ボタンを横並び配置
     - 読み方向セクション：縦読み・横読みボタンを横並び配置
     - アイコン付きボタン（enlarge_on/off.png, reduce_on/off.png, tate_on/off.png, yoko_on/off.png）
     - 選択中のボタンは青色（#396BD6）で強調表示
   - シームレスモード時のみサブメニューを表示

2. **自動再生ボタンの再設計**
   - 画面左下に固定配置（bottom: 30px, left: 30px）
   - 黒背景・白文字の角丸ボタン
   - アイコン付き（play_start.png / play_stop.png）
   - 再生時は「再生中」、停止時は「自動再生」と表示

3. **モード切り替えボタンの再設計**
   - 画面右下に白い角丸コンテナで2つのボタンを横並び配置
   - 見開きモード時：
     - シームレスボタン（active）: button_seamless_off.png
     - 見開きボタン（inactive）: button_mihiraki_on.png
   - シームレスモード時：
     - シームレスボタン（inactive）: button_seamless_on.png
     - 見開きボタン（active）: button_mihiraki_off.png

4. **全画面表示ボタンの再設計**
   - 画面右下に配置（最も右端）
   - アイコンのみ表示（背景なし）
   - 通常時: fullscreen.png
   - 全画面表示中: fullscreen_cancel.png
   - 自動的にアイコンが切り替わる

5. **モバイル対応**
   - モバイルデバイス判別機能を追加（isMobileDevice()）
     - User-Agent による判別
     - タッチデバイス + 画面幅1024px以下の判定
   - モバイルデバイスでの表示調整：
     - 全画面表示ボタンを非表示
     - モード切り替えボタンを右端（right: 30px）に配置

6. **ボタン配置の最適化**
   - PC版：左から「自動再生（左下）」「モード切り替え（右下中央）」「全画面（右下右端）」
   - モバイル版：左から「自動再生（左下）」「モード切り替え（右下右端）」

7. **UI要素の自動表示/非表示機能**（2025-11-14 セッション2）
   - 全てのUI要素をデフォルトで非表示（透明化）
   - 画面タップ/クリックで表示
     - 見開きモード：ページ送りボタン以外の場所をタップ
     - シームレスモード：画面のどこをタップしても表示
   - 最後の操作から3秒後に自動的にフェードアウト
   - UI要素上にマウスがある間は非表示にならない
   - 対象UI要素：
     - サブメニューオープンボタン（右上）
     - 自動再生ボタン（左下）
     - モード切り替えボタン（右下中央）
     - 全画面表示ボタン（右下右端）
   - 実装方法：
     - CSS: `opacity` + `pointer-events` によるスムーズなフェード（0.3秒）
     - JavaScript: タイマー管理とマウス/タッチイベントの統合処理
   - より没入感の高い読書体験を実現

### 過去のセッションで実装した機能（2025-11-11以前）
1. **デモ版として20ページまでの閲覧制限**（2025-11-11）
   - src/main.cpp: `maxPages` を209から20に変更（main.cpp:48）
   - index.html: `MAX_PAGES` を209から20に変更（index.html:470）
   - コメントを「テスト用画像の最大ページ数」から「デモ版の最大ページ数」に変更
   - 見開きモード・シームレスモードの両方で20ページまでの閲覧に制限
   - 21ページ目以降へのページめくりや先読みは行われない
   - ビルド完了: mukuviewer.js (36KB), mukuviewer.wasm (125KB)

2. **暗号化画像の復号化対応**
   - src/cipher.cppを追加（AES-128暗号化/復号化ライブラリ）
   - build.shを更新してcipher.cppをコンパイル対象に追加
   - 画像URLを`.jpg.enc`に変更（暗号化画像を取得）
   - ダウンロード後に`invCipher()`関数で自動的に復号化
   - 暗号化アルゴリズム: AES-128（128ビット鍵、10ラウンド、PKCS#7パディング）
   - 暗号化キー: `"1234567890123456"`（16バイト固定）
   - 復号化処理はstb_imageによる画像デコードの前に実行される

2. **縮小表示機能（シームレスモード）**
   - 縮小表示ボタンの追加（シームレス時のみ表示）
   - 3段階の表示倍率に対応（縮小0.5倍、標準1倍、拡大2倍）
   - 縮小・拡大表示ボタンは排他的に動作（片方をオンにすると他方は自動オフ）
   - 横読みモード・縦読みモードの両方に対応
   - 縮小・拡大時は両方向にドラッグスクロール可能
     - 横読みモード + 倍率変更時：横方向と縦方向の両方にスクロール
     - 縦読みモード + 倍率変更時：縦方向と横方向の両方にスクロール
   - 縮小表示時の画像配置を縦方向中央に（横読みモード）

3. **ナビゲーションバーの自動表示/非表示**
   - デフォルトで非表示（画面をすっきり表示）
   - マウスが画面下部100px以内に入ると自動表示
   - 画面下部100px以内をクリック/タップで表示（モバイル対応）
   - 表示後3秒間操作がないと自動で非表示
   - ナビゲーションバー上にマウスがある間は非表示にならない
   - スムーズなフェードイン/フェードアウトアニメーション（0.3秒）

4. **技術的改善**
   - `zoomEnabled`（boolean）を`zoomLevel`（数値）に変更し、柔軟な倍率管理を実現
   - スクロール位置を倍率変更時に自動調整する処理を改善
   - Canvas要素のサイズを倍率に応じて動的に再計算
   - Flexboxの`align-items: center`を使用して縮小時の画像を中央配置

### エクスポート関数（C++）
**コア機能**：
- `initialize(book_id)` - 初期化
- `nextPage()` - 次ページへ
- `prevPage()` - 前ページへ
- `refresh()` - 再描画
- `printCacheStatus()` - キャッシュ状態表示
- `preloadPagesDelayed()` - 遅延先読み
- `renderSinglePage(pageNum, canvasId)` - 単一ページ描画
- `loadPageToCache(pageNum)` - ページをキャッシュに読み込み
- `setSinglePageMode(enabled)` - 1ページ/2ページモード切り替え

**ユーティリティ関数**（2025-11-20追加）：
- `isLandscape()` - 画面の向きを判定
- `isMobileDevice()` - モバイルデバイスかどうかを判定

**UI制御関数**（2025-11-20追加）：
- `updateFullscreenIcon()` - 全画面アイコンを更新
- `updateSubmenuVisibility(viewMode)` - サブメニューの表示/非表示を更新
- `updateModeSwitchButtons(viewMode)` - モード切り替えボタンを更新
- `updateDirectionButtons(direction)` - 読み方向ボタンを更新
- `showUIControls()` - UI要素を表示
- `hideUIControls()` - UI要素を非表示

## 連絡事項

### 確認すべき項目
1. ✅ ページめくりの体感速度が改善されたか → 先読み機能で改善
2. ✅ 先読みがUIをブロックしていないか → 優先度ベースの読み込みで解決
3. ✅ メモリ使用量が許容範囲か → キャッシュ管理で最適化
4. ✅ 縦読み/横読みモードの実装 → 完了
5. ✅ 画面の向きに応じた自動切り替え → 完了
6. ✅ スプラッシュ画面の追加 → 完了
7. ✅ 拡大表示機能の実装 → 完了
8. ✅ 縮小表示機能の実装 → 完了（0.5倍表示対応）
9. ✅ ナビゲーションバーの自動表示/非表示 → 完了
10. ✅ コンテンツ保護機能の実装 → 完了（右クリック・ドラッグ保存防止）
11. ✅ デモ版として20ページまでの閲覧制限 → 完了
12. ✅ UIの再設計とメニュー整理 → 完了
13. ✅ モバイルデバイス対応 → 完了
14. ✅ UI要素の自動表示/非表示機能 → 完了
15. ✅ モバイルブラウザでの画像品質改善 → 完了（devicePixelRatio対応、モアレ対策）
16. ✅ JavaScriptコードのWASM化 → 完了（セキュリティ強化、約300行移動）
17. ✅ Windowリサイズ時の動作問題 → 完了（通常モード・シームレスモードの両方）
18. ✅ 自動再生ボタンの表示問題 → 完了（再表示時の問題を解決）

### 本セッションで実装した機能（2025-11-20）

#### 1. JavaScriptコードのWASM化（セキュリティ強化）
**目的**: JavaScriptコードをできるだけユーザーの目に触れないようにする

**main.cppに移動した関数（約300行）**：
- **ユーティリティ関数**
  - `isLandscape()` - 画面の向きを判定（main.cpp:572-576）
  - `isMobileDevice()` - モバイルデバイスかどうかを判定（main.cpp:578-587）

- **UI制御関数**
  - `updateFullscreenIcon()` - 全画面アイコンを更新（main.cpp:589-601）
  - `updateSubmenuVisibility()` - サブメニューの表示/非表示を更新（main.cpp:603-625）
  - `updateModeSwitchButtons()` - モード切り替えボタンを更新（main.cpp:627-650）
  - `updateDirectionButtons()` - 読み方向ボタンを更新（main.cpp:652-667）
  - `showUIControls()` - UI要素を表示（main.cpp:671-714）
  - `hideUIControls()` - UI要素を非表示（main.cpp:716-729）

**index.htmlの変更**：
- 上記の関数を削除し、`Module.ccall()` でC++側の関数を呼び出すように変更
- イベントリスナー設定は複雑なため、最小限のコードに圧縮（約10行）
- `isLandscape()`と`isMobileDevice()`の呼び出しを直接的な判定式に置き換え
  - `isLandscape()` → `window.innerWidth > window.innerHeight`
  - `isMobileDevice()` → インライン判定式

**効果**：
- 約300行のJavaScriptコードがWASMバイナリに移動
- ユーザーがブラウザのDevToolsで見えるJavaScriptコードが大幅に削減
- WASMファイルは難読化されているため、コードロジックの解読が困難に

**ビルド結果**：
```
mukuviewer.js:  40KB（36KB → 40KB、+4KB）
mukuviewer.wasm: 125KB（変更なし）
```

#### 2. Windowリサイズ時の動作問題を修正
**問題**：
- 通常モード：Windowをリサイズしても画像表示サイズが変わらない、1ページ/2ページ表示が切り替わらない
- シームレスモード：Windowサイズにより縦スクロール/横スクロールを切り替える部分が動作しない

**原因**：
- `isLandscape()`をC++側に移動したことで、`Module.ccall()`を使った呼び出しが必要になり、タイミングの問題が発生
- 初期化時やリサイズ時にModule.ccallがまだ利用できない状態でisLandscape()を呼び出していた

**修正内容**：
- リサイズイベントハンドラーで`isLandscape()`の代わりに直接 `window.innerWidth > window.innerHeight` を使用（index.html:2122, 2128）
- 初期化時も同様に直接判定（index.html:766）
- シームレスモード切り替え時も直接判定（index.html:1088）

**効果**：
- ✅ 通常モード：Windowリサイズ時に画像サイズが自動調整され、1ページ/2ページ表示が切り替わる
- ✅ シームレスモード：Windowリサイズ時に縦読み/横読みが自動的に切り替わる

#### 3. 自動再生ボタンの表示問題を修正
**問題1**：シームレスモードに切り替えた際、自動再生ボタンが見当たらない
**原因**：`visible`クラスのみ追加され、`show`クラスが追加されていなかったため、`opacity: 0`のまま表示されなかった

**修正内容**：
- `switchToSeamlessMode()`で自動再生ボタンに`visible`と`show`の両方のクラスを追加（index.html:1095-1099）
- `switchToNormalMode()`で自動再生ボタンから両方のクラスを削除（index.html:1159-1161）
- `updateSubmenuVisibility()`でサブメニューボタンにも`show`クラスを追加/削除（main.cpp:610-614）

**問題2**：一定時間画面クリックがなく自動再生ボタンが一旦消えた後、再度画面クリックした際に他のボタンは表示されるが自動再生ボタンだけ表示されない

**原因**：
- `viewMode`変数が`let`で宣言されていたため、`window.viewMode`として参照できなかった
- C++側の`showUIControls()`では`window.viewMode`を参照していたが、`undefined`になり常に`'normal'`と判定されていた
- そのため、`if (viewMode !== 'normal')`の条件が常に`false`となり、自動再生ボタンが表示されなかった

**修正内容**：
- `viewMode`を`var`で宣言し、`window.viewMode`として管理（index.html:963-964）
- viewMode変更時に`window.viewMode`も同時に更新（index.html:1091, 1147, 1205, 1215, 2167, 2179）
- これにより、C++側の`showUIControls()`が正しく`window.viewMode`を参照できるようになった

**効果**：
- ✅ シームレスモードで自動再生ボタンが正しく表示される
- ✅ UI要素が非表示になった後、再度画面クリックで自動再生ボタンも含めてすべてのボタンが再表示される

#### 4. エクスポート関数の追加（C++）
以下の関数を追加してJavaScript側から呼び出せるようにした：
- `isLandscape()` - 画面の向きを判定
- `isMobileDevice()` - モバイルデバイスかどうかを判定
- `updateFullscreenIcon()` - 全画面アイコンを更新
- `updateSubmenuVisibility(viewMode)` - サブメニューの表示/非表示を更新
- `updateModeSwitchButtons(viewMode)` - モード切り替えボタンを更新
- `updateDirectionButtons(direction)` - 読み方向ボタンを更新
- `showUIControls()` - UI要素を表示
- `hideUIControls()` - UI要素を非表示

### 次のステップ候補
- ページ番号表示UIの追加
- 自動再生速度の調整機能
- ページジャンプ機能
- ローディングインジケーター
- より多段階の倍率選択（0.25倍、0.75倍、1.5倍など）
- デバッグログの削除（本番環境用）
- ページ履歴の保存（LocalStorage利用）

## 最終更新

- **日付**: 2025-11-20
- **最終ビルド**: mukuviewer.js (40KB), mukuviewer.wasm (125KB)
- **作業状況**: JavaScriptコードのWASM化（セキュリティ強化）、Windowリサイズ対応修正、自動再生ボタン表示問題修正
