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

### 表示方式
- 見開き表示（2ページ同時表示）
- 右めくり方式：1ページ目が右側、2ページ目が左側
- アスペクト比を保持しながら画面いっぱいに表示

## 実装済み機能

### 1. コア機能
- [x] WebAssemblyベースのビューア
- [x] JPEG画像の読み込みとデコード（stb_image使用）
- [x] 見開き2ページ表示
- [x] ページ送り・戻し機能
- [x] レスポンシブ表示（ウィンドウサイズに自動適応）

### 2. 先読み機能（パフォーマンス最適化）
- [x] 現在ページから20ページ先まで先読み
- [x] 優先度ベースの読み込み
  - 即座：現在+4ページ（見開き2回分）
  - 遅延：残り16ページ（100ms後）
- [x] インテリジェントキャッシュ管理
  - 前後15ページまで保持
  - 古いキャッシュは自動削除
- [x] 重複読み込み防止

### 3. UI/UX
- [x] 左右端のナビゲーションボタン
- [x] キーボードショートカット
  - ← : 次のページ
  - → : 前のページ
  - C : キャッシュステータス表示
- [x] ウィンドウリサイズ時の自動再描画
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

### ページキャッシュシステム
```cpp
std::map<int, ImageData> pageCache;  // ページ番号をキーにしたキャッシュ
std::set<int> loadingPages;          // 読み込み中のページ番号

static const int PRELOAD_PAGES = 20;  // 先読みするページ数
```

### 画像デコードフロー
1. `emscripten_fetch` で画像をダウンロード
2. `stbi_load_from_memory` でJPEGをRGBAにデコード
3. C++の`std::vector`にデータ保存
4. JavaScript側で`ImageData`オブジェクトに変換
5. Canvasに描画

### 描画最適化
- アスペクト比計算により画面サイズに最適化
- 一時Canvasを使用して高品質リサイズ
- 見開き2ページの幅比率を保持

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
- [ ] ページ番号表示UI
- [ ] エラーハンドリングの強化（404時など）
- [ ] タッチジェスチャー対応（モバイル準備）

### 中期的改善
- [ ] ページ総数の動的取得（現在は固定100ページ）
- [ ] ブックマーク機能
- [ ] ページジャンプ機能
- [ ] 全画面表示モード
- [ ] 画像圧縮最適化（WebP対応検討）

### 長期的改善
- [ ] モバイルブラウザ対応
- [ ] 縦スクロール表示モード
- [ ] 複数のコミックを管理するライブラリ機能
- [ ] オフライン対応（Service Worker + IndexedDB）
- [ ] PDF出力機能

## デバッグ方法

### ブラウザコンソールでの確認
```javascript
// キャッシュ状態を表示
Module.ccall('printCacheStatus', null, [], []);

// 手動で次ページへ
Module.ccall('nextPage', null, [], []);

// 画面を再描画
Module.ccall('refresh', null, [], []);
```

### よく使うログ
```
[WASM] Initialized viewer with book_id: 00000001
[WASM] Loading pages 1 and 2
[WASM] Fetching: https://mvtest.ci-labo.net/images/00000001/1.jpg
[WASM] Image decoded (page 1): 800x1200, channels: 3
[WASM] Rendering pages 1 and 2...
[WASM] Preloading pages from 1 to 21
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
- **最終ビルド**: mukuviewer.js (35KB), mukuviewer.wasm (120KB)
- **作業状況**: 先読み機能の最適化完了、動作確認待ち

## 連絡事項

会議後に確認すべき項目：
1. ページめくりの体感速度が改善されたか
2. 先読みがUIをブロックしていないか
3. メモリ使用量が許容範囲か
4. 追加で必要な機能があるか
