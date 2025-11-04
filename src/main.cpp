#include <emscripten.h>
#include <emscripten/bind.h>
#include <emscripten/fetch.h>
#include <emscripten/html5.h>
#include <string>
#include <vector>
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

    ImageData() : width(0), height(0), channels(0), loaded(false) {}
};

// フェッチコールバックに渡すデータ
struct FetchUserData {
    int slot;
    class ComicViewer* viewer;
};

// ビューアの状態
class ComicViewer {
private:
    std::string bookId;
    int currentPage;
    int maxPages;
    ImageData pageImages[2]; // 見開き用に2ページ分
    const char* canvasTarget;
    int loadedCount;

public:
    ComicViewer() : bookId("00000001"), currentPage(1), maxPages(100),
                    canvasTarget("#viewer-canvas"), loadedCount(0) {}

    void initialize(const std::string& book_id) {
        bookId = book_id;
        currentPage = 1;
        printf("Initialized viewer with book_id: %s\n", bookId.c_str());
        loadCurrentPages();
    }

    void loadCurrentPages() {
        printf("Loading pages %d and %d\n", currentPage, currentPage + 1);
        loadedCount = 0;
        pageImages[0].loaded = false;
        pageImages[1].loaded = false;
        loadPage(0, currentPage);
        loadPage(1, currentPage + 1);
    }

    void loadPage(int slot, int pageNum) {
        if (pageNum < 1 || pageNum > maxPages) {
            pageImages[slot].loaded = false;
            checkAndRender();
            return;
        }

        // 画像URLの構築
        char url[256];
        snprintf(url, sizeof(url), "https://mvtest.ci-labo.net/images/%s/%d.jpg", bookId.c_str(), pageNum);

        printf("Fetching: %s\n", url);

        // Fetch属性の設定
        emscripten_fetch_attr_t attr;
        emscripten_fetch_attr_init(&attr);
        strcpy(attr.requestMethod, "GET");
        attr.attributes = EMSCRIPTEN_FETCH_LOAD_TO_MEMORY;
        attr.onsuccess = onFetchSuccess;
        attr.onerror = onFetchError;

        // ユーザーデータとしてslot情報とviewerポインタを渡す
        FetchUserData* userData = new FetchUserData();
        userData->slot = slot;
        userData->viewer = this;
        attr.userData = userData;

        emscripten_fetch(&attr, url);
    }

    static void onFetchSuccess(emscripten_fetch_t* fetch) {
        printf("Fetch success: %llu bytes\n", fetch->numBytes);

        FetchUserData* userData = (FetchUserData*)fetch->userData;
        int slot = userData->slot;
        ComicViewer* viewer = userData->viewer;
        delete userData;

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
            printf("Image decoded: %dx%d, channels: %d\n", width, height, channels);

            viewer->pageImages[slot].width = width;
            viewer->pageImages[slot].height = height;
            viewer->pageImages[slot].channels = 4;
            viewer->pageImages[slot].data.assign(imageData, imageData + (width * height * 4));
            viewer->pageImages[slot].loaded = true;

            stbi_image_free(imageData);
            viewer->loadedCount++;

            viewer->checkAndRender();
        } else {
            printf("Failed to decode image: %s\n", stbi_failure_reason());
            viewer->pageImages[slot].loaded = false;
        }

        emscripten_fetch_close(fetch);
    }

    static void onFetchError(emscripten_fetch_t* fetch) {
        printf("Fetch error: %d %s\n", fetch->status, fetch->statusText);

        FetchUserData* userData = (FetchUserData*)fetch->userData;
        int slot = userData->slot;
        ComicViewer* viewer = userData->viewer;
        delete userData;

        viewer->pageImages[slot].loaded = false;
        emscripten_fetch_close(fetch);

        viewer->checkAndRender();
    }

    void checkAndRender() {
        // 少なくとも1ページが読み込まれたら描画
        if (pageImages[0].loaded || pageImages[1].loaded) {
            renderPages();
        }
    }

    void renderPages() {
        printf("Rendering pages...\n");

        // Canvasのサイズを取得
        double canvasWidth, canvasHeight;
        emscripten_get_element_css_size(canvasTarget, &canvasWidth, &canvasHeight);

        // 実際のCanvasサイズを設定（高解像度対応）
        int displayWidth = (int)canvasWidth;
        int displayHeight = (int)canvasHeight;

        emscripten_set_canvas_element_size(canvasTarget, displayWidth, displayHeight);

        // 2Dコンテキストを取得してJavaScript側で描画
        EM_ASM({
            const canvas = document.getElementById('viewer-canvas');
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        });

        // 右ページ（1ページ目）を描画
        if (pageImages[0].loaded) {
            drawImageToCanvas(0, displayWidth / 2, 0, displayWidth / 2, displayHeight);
        }

        // 左ページ（2ページ目）を描画
        if (pageImages[1].loaded) {
            drawImageToCanvas(1, 0, 0, displayWidth / 2, displayHeight);
        }
    }

    void drawImageToCanvas(int slot, int x, int y, int width, int height) {
        ImageData& img = pageImages[slot];
        if (!img.loaded) return;

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
            loadCurrentPages();
            printf("Next page: %d\n", currentPage);
        }
    }

    void prevPage() {
        if (currentPage > 1) {
            currentPage = (currentPage - 2 < 1) ? 1 : currentPage - 2;
            loadCurrentPages();
            printf("Previous page: %d\n", currentPage);
        }
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
}

int main() {
    printf("mukuviewer initialized\n");
    return 0;
}
