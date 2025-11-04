#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/fetch.h>
#include <emscripten/html5.h>
#include <string>
#include <vector>
#include <map>
#include <set>
#include <cstdio>
#include <cstring>

#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"

// 画像データ構造
struct ImageData {
    std::vector<unsigned char> data;
    int width;
    int height;
    int channels;
    bool loaded;
    bool loading;  // 読み込み中フラグ

    ImageData() : width(0), height(0), channels(0), loaded(false), loading(false) {}
};

// フェッチコールバックに渡すデータ
struct FetchUserData {
    int pageNum;
    class ComicViewer* viewer;
};

// ビューアの状態
class ComicViewer {
private:
    std::string bookId;
    int currentPage;
    int maxPages;
    std::map<int, ImageData> pageCache;  // ページ番号をキーにしたキャッシュ
    std::set<int> loadingPages;          // 読み込み中のページ番号
    const char* canvasTarget;
    static const int PRELOAD_PAGES = 20;  // 先読みするページ数

public:
    ComicViewer() : bookId("00000001"), currentPage(1), maxPages(100),
                    canvasTarget("#viewer-canvas") {}

    void initialize(const std::string& book_id) {
        bookId = book_id;
        currentPage = 1;
        printf("Initialized viewer with book_id: %s\n", bookId.c_str());
        loadCurrentPages();
        preloadPages();
    }

    void loadCurrentPages() {
        printf("Loading pages %d and %d\n", currentPage, currentPage + 1);
        loadPageToCache(currentPage);
        loadPageToCache(currentPage + 1);
    }

    void loadPageToCache(int pageNum) {
        if (pageNum < 1 || pageNum > maxPages) {
            return;
        }

        // すでにキャッシュにある、または読み込み中の場合はスキップ
        if (pageCache.find(pageNum) != pageCache.end() && pageCache[pageNum].loaded) {
            // printf("Page %d already cached\n", pageNum);
            return;
        }

        if (loadingPages.find(pageNum) != loadingPages.end()) {
            // printf("Page %d is already loading\n", pageNum);
            return;
        }

        // 画像URLの構築
        char url[256];
        snprintf(url, sizeof(url), "https://mvtest.ci-labo.net/images/%s/%d.jpg", bookId.c_str(), pageNum);

        printf("Fetching: %s\n", url);

        // キャッシュエントリを作成
        if (pageCache.find(pageNum) == pageCache.end()) {
            pageCache[pageNum] = ImageData();
        }
        pageCache[pageNum].loading = true;
        loadingPages.insert(pageNum);

        // Fetch属性の設定
        emscripten_fetch_attr_t attr;
        emscripten_fetch_attr_init(&attr);
        strcpy(attr.requestMethod, "GET");
        attr.attributes = EMSCRIPTEN_FETCH_LOAD_TO_MEMORY;
        attr.onsuccess = onFetchSuccess;
        attr.onerror = onFetchError;

        // ユーザーデータとしてページ番号とviewerポインタを渡す
        FetchUserData* userData = new FetchUserData();
        userData->pageNum = pageNum;
        userData->viewer = this;
        attr.userData = userData;

        emscripten_fetch(&attr, url);
    }

    static void onFetchSuccess(emscripten_fetch_t* fetch) {
        printf("Fetch success: %llu bytes\n", fetch->numBytes);

        FetchUserData* userData = (FetchUserData*)fetch->userData;
        int pageNum = userData->pageNum;
        ComicViewer* viewer = userData->viewer;
        delete userData;

        // 読み込み中フラグを削除
        viewer->loadingPages.erase(pageNum);

        // 画像をデコード
        int width, height, channels;
        unsigned char* imageData = stbi_load_from_memory(
            (unsigned char*)fetch->data,
            fetch->numBytes,
            &width,
            &height,
            &channels,
            4  // RGBA形式を要求
        );

        if (imageData) {
            printf("Image decoded (page %d): %dx%d, channels: %d\n", pageNum, width, height, channels);

            viewer->pageCache[pageNum].width = width;
            viewer->pageCache[pageNum].height = height;
            viewer->pageCache[pageNum].channels = 4;
            viewer->pageCache[pageNum].data.assign(imageData, imageData + (width * height * 4));
            viewer->pageCache[pageNum].loaded = true;
            viewer->pageCache[pageNum].loading = false;

            stbi_image_free(imageData);

            // 現在のページが読み込まれたら描画
            if (pageNum == viewer->currentPage || pageNum == viewer->currentPage + 1) {
                viewer->checkAndRender();
            }
        } else {
            printf("Failed to decode image (page %d): %s\n", pageNum, stbi_failure_reason());
            viewer->pageCache[pageNum].loaded = false;
            viewer->pageCache[pageNum].loading = false;
        }

        emscripten_fetch_close(fetch);
    }

    static void onFetchError(emscripten_fetch_t* fetch) {
        printf("Fetch error: %d %s\n", fetch->status, fetch->statusText);

        FetchUserData* userData = (FetchUserData*)fetch->userData;
        int pageNum = userData->pageNum;
        ComicViewer* viewer = userData->viewer;
        delete userData;

        viewer->loadingPages.erase(pageNum);
        viewer->pageCache[pageNum].loaded = false;
        viewer->pageCache[pageNum].loading = false;

        emscripten_fetch_close(fetch);
    }

    void preloadPages() {
        printf("Preloading pages from %d to %d\n", currentPage, currentPage + PRELOAD_PAGES);

        // 優先度の高いページ（次の見開き2ページ）を即座に読み込む
        const int IMMEDIATE_PRELOAD = 4;  // 即座に読み込むページ数
        for (int i = currentPage; i <= currentPage + IMMEDIATE_PRELOAD && i <= maxPages; i++) {
            loadPageToCache(i);
        }

        // 残りのページは遅延して読み込む（JavaScriptのsetTimeoutで実行）
        if (currentPage + IMMEDIATE_PRELOAD < currentPage + PRELOAD_PAGES) {
            EM_ASM({
                setTimeout(function() {
                    if (Module.ccall) {
                        Module.ccall('preloadPagesDelayed', null, [], []);
                    }
                }, 100);  // 100ms後に実行
            });
        }

        // 古いキャッシュを削除（メモリ管理）
        cleanupOldCache();
    }

    void preloadPagesDelayed() {
        printf("Delayed preloading...\n");
        // 優先度の低いページを少しずつ読み込む
        const int IMMEDIATE_PRELOAD = 4;
        for (int i = currentPage + IMMEDIATE_PRELOAD + 1; i <= currentPage + PRELOAD_PAGES && i <= maxPages; i++) {
            loadPageToCache(i);
        }
    }

    void cleanupOldCache() {
        // 現在のページから離れすぎたキャッシュを削除
        const int CACHE_RANGE = 15;  // 前後15ページまで保持
        std::vector<int> toDelete;

        for (auto& pair : pageCache) {
            int pageNum = pair.first;
            if (pageNum < currentPage - 5 || pageNum > currentPage + CACHE_RANGE) {
                toDelete.push_back(pageNum);
            }
        }

        for (int pageNum : toDelete) {
            printf("Removing page %d from cache\n", pageNum);
            pageCache.erase(pageNum);
        }
    }

    void checkAndRender() {
        // 現在表示すべきページが読み込まれているか確認
        bool page0Ready = (pageCache.find(currentPage) != pageCache.end() &&
                          pageCache[currentPage].loaded);
        bool page1Ready = (pageCache.find(currentPage + 1) != pageCache.end() &&
                          pageCache[currentPage + 1].loaded);

        if (page0Ready || page1Ready) {
            renderPages();
        }
    }

    void renderPages() {
        printf("Rendering pages %d and %d...\n", currentPage, currentPage + 1);

        // Canvasのサイズを取得（ウィンドウサイズ）
        double canvasWidth, canvasHeight;
        emscripten_get_element_css_size(canvasTarget, &canvasWidth, &canvasHeight);

        // 見開き2ページ分の合計サイズを計算
        int totalImageWidth = 0;
        int maxImageHeight = 0;

        bool page0Exists = (pageCache.find(currentPage) != pageCache.end() &&
                           pageCache[currentPage].loaded);
        bool page1Exists = (pageCache.find(currentPage + 1) != pageCache.end() &&
                           pageCache[currentPage + 1].loaded);

        if (page0Exists) {
            totalImageWidth += pageCache[currentPage].width;
            maxImageHeight = pageCache[currentPage].height;
        }
        if (page1Exists) {
            totalImageWidth += pageCache[currentPage + 1].width;
            if (pageCache[currentPage + 1].height > maxImageHeight) {
                maxImageHeight = pageCache[currentPage + 1].height;
            }
        }

        if (totalImageWidth == 0 || maxImageHeight == 0) {
            printf("No pages to render\n");
            return;
        }

        // アスペクト比を保持しながら画面いっぱいに表示するサイズを計算
        double imageAspect = (double)totalImageWidth / maxImageHeight;
        double screenAspect = canvasWidth / canvasHeight;

        int displayWidth, displayHeight;
        int offsetX = 0, offsetY = 0;

        if (imageAspect > screenAspect) {
            // 画像が横長：幅を基準にする
            displayWidth = (int)canvasWidth;
            displayHeight = (int)(canvasWidth / imageAspect);
            offsetY = ((int)canvasHeight - displayHeight) / 2;
        } else {
            // 画像が縦長：高さを基準にする
            displayHeight = (int)canvasHeight;
            displayWidth = (int)(canvasHeight * imageAspect);
            offsetX = ((int)canvasWidth - displayWidth) / 2;
        }

        printf("Canvas: %.0fx%.0f, Image: %dx%d, Display: %dx%d, Offset: %d,%d\n",
               canvasWidth, canvasHeight, totalImageWidth, maxImageHeight,
               displayWidth, displayHeight, offsetX, offsetY);

        // Canvasサイズを設定
        emscripten_set_canvas_element_size(canvasTarget, (int)canvasWidth, (int)canvasHeight);

        // 背景をクリア
        EM_ASM({
            const canvas = document.getElementById('viewer-canvas');
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        });

        // 各ページの幅を計算（比率を保持）
        int page0Width = 0, page1Width = 0;
        if (page0Exists && page1Exists) {
            // 両方読み込まれている場合
            double ratio0 = (double)pageCache[currentPage].width / totalImageWidth;
            double ratio1 = (double)pageCache[currentPage + 1].width / totalImageWidth;
            page0Width = (int)(displayWidth * ratio0);
            page1Width = (int)(displayWidth * ratio1);
        } else if (page0Exists) {
            page0Width = displayWidth;
        } else if (page1Exists) {
            page1Width = displayWidth;
        }

        // 右ページ（1ページ目）を描画
        if (page0Exists) {
            drawImageToCanvas(currentPage, offsetX + page1Width, offsetY, page0Width, displayHeight);
        }

        // 左ページ（2ページ目）を描画
        if (page1Exists) {
            drawImageToCanvas(currentPage + 1, offsetX, offsetY, page1Width, displayHeight);
        }
    }

    void drawImageToCanvas(int pageNum, int x, int y, int width, int height) {
        if (pageCache.find(pageNum) == pageCache.end() || !pageCache[pageNum].loaded) {
            return;
        }

        ImageData& img = pageCache[pageNum];

        // JavaScript側でImageDataを作成して描画
        EM_ASM({
            const canvas = document.getElementById('viewer-canvas');
            const ctx = canvas.getContext('2d');

            const width = $0;
            const height = $1;
            const dataPtr = $2;
            const dataSize = $3;
            const x = $4;
            const y = $5;
            const drawWidth = $6;
            const drawHeight = $7;

            // メモリからデータを取得（コピーを作成）
            const srcData = HEAPU8.subarray(dataPtr, dataPtr + dataSize);
            const data = new Uint8ClampedArray(srcData);
            const imageData = new ImageData(data, width, height);

            // 一時的なCanvasを作成して画像を描画
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.putImageData(imageData, 0, 0);

            // メインCanvasにリサイズして描画
            ctx.drawImage(tempCanvas, x, y, drawWidth, drawHeight);

        }, img.width, img.height, img.data.data(), img.data.size(), x, y, width, height);
    }

    void nextPage() {
        if (currentPage + 2 <= maxPages) {
            currentPage += 2;
            printf("Next page: %d\n", currentPage);

            // キャッシュから即座に描画
            checkAndRender();

            // 先読みを開始
            preloadPages();
        }
    }

    void prevPage() {
        if (currentPage > 1) {
            currentPage = (currentPage - 2 < 1) ? 1 : currentPage - 2;
            printf("Previous page: %d\n", currentPage);

            // キャッシュから即座に描画
            checkAndRender();

            // 先読みを開始（前方向にも読み込む）
            preloadPages();
        }
    }

    void refresh() {
        // 現在のページを再描画
        checkAndRender();
    }

    void printCacheStatus() {
        printf("=== Cache Status ===\n");
        printf("Current Page: %d\n", currentPage);
        printf("Cached Pages: ");
        for (auto& pair : pageCache) {
            if (pair.second.loaded) {
                printf("%d ", pair.first);
            }
        }
        printf("\nLoading Pages: ");
        for (int pageNum : loadingPages) {
            printf("%d ", pageNum);
        }
        printf("\n===================\n");
    }
};

// グローバルインスタンス
ComicViewer* viewer = nullptr;

// エクスポート関数
extern "C" {
    EMSCRIPTEN_KEEPALIVE
    void initialize(const char* book_id) {
        if (!viewer) {
            viewer = new ComicViewer();
        }
        viewer->initialize(book_id);
    }

    EMSCRIPTEN_KEEPALIVE
    void nextPage() {
        if (viewer) {
            viewer->nextPage();
        }
    }

    EMSCRIPTEN_KEEPALIVE
    void prevPage() {
        if (viewer) {
            viewer->prevPage();
        }
    }

    EMSCRIPTEN_KEEPALIVE
    void refresh() {
        if (viewer) {
            viewer->refresh();
        }
    }

    EMSCRIPTEN_KEEPALIVE
    void printCacheStatus() {
        if (viewer) {
            viewer->printCacheStatus();
        }
    }

    EMSCRIPTEN_KEEPALIVE
    void preloadPagesDelayed() {
        if (viewer) {
            viewer->preloadPagesDelayed();
        }
    }
}

int main() {
    printf("mukuviewer initialized\n");
    return 0;
}
