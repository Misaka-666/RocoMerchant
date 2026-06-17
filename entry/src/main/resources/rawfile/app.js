const API_URL = "https://wegame.shallow.ink/api/v1/games/rocom/merchant/info";
let _reqId = 0;
const _pending = {};

function log(msg) { console.log("[RocoMerchant] " + msg); }

// Native bridge callback - called from Kotlin
function _nativeCallback(requestId, responseStr) {
    const p = _pending[requestId];
    if (!p) return;
    delete _pending[requestId];
    try {
        const resp = JSON.parse(responseStr);
        if (resp.error) {
            p.reject(new Error(resp.error));
        } else if (resp.status >= 200 && resp.status < 300) {
            const json = resp.body;
            if (json.code !== 0) {
                p.reject(new Error(json.message || "接口返回错误"));
            } else {
                p.resolve(json.data || json);
            }
        } else {
            p.reject(new Error("HTTP " + resp.status));
        }
    } catch (e) {
        p.reject(new Error("响应解析失败"));
    }
}

function getApiKey() {
    try {
        if (window.AndroidBridge) return window.AndroidBridge.getApiKey();
    } catch (e) { log("getApiKey bridge error: " + e); }
    return localStorage.getItem("api_key") || "";
}

function openSettings() {
    if (window.AndroidBridge) {
        window.AndroidBridge.openSettings();
    }
}

function showState(id) {
    ["loading", "error-state", "no-key-state", "products-container", "history-section", "btn-refresh"]
        .forEach(s => {
            const el = document.getElementById(s === "loading" ? "loading" : s);
            if (el) el.style.display = "none";
        });
    const el = document.getElementById(id);
    if (el) el.style.display = id === "products-container" ? "flex" : "block";
}

function formatTimestamp(tsMs) {
    if (!tsMs) return "--:--";
    const d = new Date(Number(tsMs));
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return hh + ":" + mm;
}

function getRoundInfo() {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes();
    if (h < 8) return { current: "未开放", total: 4, countdown: "尚未开市" };

    const startMin = 8 * 60;
    const nowMin = h * 60 + m;
    const roundIndex = Math.floor((nowMin - startMin) / (4 * 60)) + 1;

    if (roundIndex > 4) return { current: 4, total: 4, countdown: "今日已收市" };

    const roundEndMin = startMin + roundIndex * 4 * 60;
    const remain = roundEndMin - nowMin;
    const rh = Math.floor(remain / 60);
    const rm = remain % 60;
    return {
        current: roundIndex,
        total: 4,
        countdown: rh > 0 ? rh + "小时" + rm + "分钟" : rm + "分钟"
    };
}

function processData(data) {
    if (!data) return null;

    const nowMs = Date.now();
    const roundInfo = getRoundInfo();

    const activities = data.merchantActivities || data.merchant_activities || [];
    const activity = activities[0] || {};

    const buckets = [
        { cat: "道具", items: activity.get_props || [] },
        { cat: "额外道具", items: activity.get_extra_props || [] },
        { cat: "精灵", items: activity.get_pets || [] }
    ];

    const randomGoods = Array.isArray(data.random_goods) ? data.random_goods : [];
    const metaMap = {};
    randomGoods.forEach(g => {
        const name = (g.goods_name || g.name || "").trim();
        if (name) metaMap[name] = g;
    });

    const allProducts = [];
    const activeProducts = [];

    buckets.forEach(bucket => {
        bucket.items.forEach(item => {
            if (!item || typeof item !== "object") return;

            const meta = metaMap[(item.name || "").trim()] || {};
            let startTime = item.start_time != null ? item.start_time : activity.start_time;
            let endTime = item.end_time != null ? item.end_time : activity.end_time;

            const startMs = startTime ? Number(startTime) : null;
            const endMs = endTime ? Number(endTime) : null;

            let isActive = true;
            if (startMs != null && endMs != null) {
                isActive = startMs <= nowMs && nowMs < endMs;
            }

            let statusLabel = "当前轮次";
            if (startMs != null && nowMs < startMs) statusLabel = "未开始";
            else if (endMs != null && nowMs >= endMs) statusLabel = "已结束";

            const startStr = formatTimestamp(startMs);
            const endStr = formatTimestamp(endMs);
            const timeLabel = startStr + " - " + endStr;

            const price = item.price != null && item.price !== "" ? item.price : meta.price;
            const limit = item.buy_limit_num != null && item.buy_limit_num !== "" ? item.buy_limit_num : meta.buy_limit_num;

            const product = {
                name: item.name || "未知商品",
                image: item.icon_url || "",
                timeLabel: timeLabel,
                startMs: startMs,
                endMs: endMs,
                isActive: isActive,
                statusLabel: statusLabel,
                price: price,
                buyLimit: limit,
                category: bucket.cat
            };

            allProducts.push(product);
            if (isActive) activeProducts.push(product);
        });
    });

    // History grouping
    const today = new Date();
    const todayStr = today.getFullYear() + "-" +
        String(today.getMonth() + 1).padStart(2, "0") + "-" +
        String(today.getDate()).padStart(2, "0");

    const grouped = {};
    allProducts.forEach(p => {
        if (p.isActive || !p.startMs) return;
        const d = new Date(p.startMs);
        const ds = d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");
        if (ds !== todayStr) return;

        const key = p.startMs + "-" + (p.endMs || "");
        if (!grouped[key]) {
            grouped[key] = {
                timeLabel: p.timeLabel,
                statusLabel: p.statusLabel,
                sort: p.startMs,
                products: []
            };
        }
        const g = grouped[key];
        if (g.products.length < 5 && !g.products.some(x => x.name === p.name)) {
            g.products.push(p);
        }
    });

    const historyGroups = Object.values(grouped)
        .sort((a, b) => a.sort - b.sort)
        .filter(g => g.products.length > 0)
        .map(g => ({ timeLabel: g.timeLabel, statusLabel: g.statusLabel, products: g.products }));

    return {
        title: activity.name || "远行商人",
        subtitle: activity.start_date || "每日 08:00 / 12:00 / 16:00 / 20:00 刷新",
        roundInfo: roundInfo,
        activeProducts: activeProducts,
        historyGroups: historyGroups
    };
}

function renderProducts(products) {
    const container = document.getElementById("products-container");
    if (!products.length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-2);padding:24px">当前轮次暂无在售商品</div>';
        return;
    }

    container.innerHTML = products.map(p => {
        const imgHtml = p.image
            ? '<div class="product-image"><img src="' + p.image + '" onerror="this.parentElement.innerHTML=\'🛒\'" alt=""></div>'
            : '<div class="product-image">🛒</div>';

        let metaHtml = '<span class="tag">' + p.category + '</span>';
        if (p.price != null) metaHtml += '<span class="tag tag-price">' + p.price + '</span>';
        if (p.buyLimit != null) metaHtml += '<span class="tag">限购' + p.buyLimit + '</span>';

        return '<div class="product-card">' +
            imgHtml +
            '<div class="product-info">' +
            '<div class="product-name">' + escHtml(p.name) + '</div>' +
            '<div class="product-meta">' + metaHtml + '</div>' +
            '</div>' +
            '<div class="product-time">' + escHtml(p.timeLabel) + '</div>' +
            '</div>';
    }).join("");
}

function renderHistory(groups) {
    const section = document.getElementById("history-section");
    const container = document.getElementById("history-container");

    if (!groups.length) {
        section.style.display = "none";
        return;
    }

    section.style.display = "block";
    container.innerHTML = groups.map(g => {
        const items = g.products.map(p => {
            const img = p.image
                ? '<div class="history-item-icon"><img src="' + p.image + '" onerror="this.style.display=\'none\'" alt=""></div>'
                : '';
            return '<div class="history-item">' + img +
                '<div class="history-item-name">' + escHtml(p.name) + '</div>' +
                '<div class="history-item-time">' + escHtml(p.timeLabel) + '</div>' +
                '</div>';
        }).join("");

        return '<div class="history-group">' +
            '<div class="history-group-header">' +
            '<span>' + escHtml(g.statusLabel) + '</span>' +
            escHtml(g.timeLabel) +
            '</div>' +
            '<div class="history-products">' + items + '</div>' +
            '</div>';
    }).join("");
}

function escHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

function requestAPI(apiKey) {
    return new Promise((resolve, reject) => {
        if (window.AndroidBridge && window.AndroidBridge.fetchApi) {
            // Use native bridge for HTTP (avoids file:// XHR restrictions)
            const id = String(++_reqId);
            _pending[id] = { resolve, reject };
            log("Requesting via native bridge, id=" + id);
            try {
                window.AndroidBridge.fetchApi(id, API_URL, apiKey);
            } catch (e) {
                delete _pending[id];
                reject(new Error("原生请求调用失败: " + e.message));
            }
            // Timeout safety
            setTimeout(function () {
                if (_pending[id]) {
                    delete _pending[id];
                    reject(new Error("请求超时"));
                }
            }, 20000);
        } else {
            // Fallback: XHR (for browser testing)
            log("Requesting via XHR fallback");
            const xhr = new XMLHttpRequest();
            xhr.open("GET", API_URL, true);
            xhr.setRequestHeader("X-API-Key", apiKey);
            xhr.timeout = 15000;
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const json = JSON.parse(xhr.responseText);
                        if (json.code !== 0) reject(new Error(json.message || "接口返回错误"));
                        else resolve(json.data || json);
                    } catch (e) { reject(new Error("JSON 解析失败")); }
                } else { reject(new Error("HTTP " + xhr.status)); }
            };
            xhr.onerror = function () { reject(new Error("网络请求失败")); };
            xhr.ontimeout = function () { reject(new Error("请求超时")); };
            xhr.send();
        }
    });
}

async function loadData() {
    const apiKey = getApiKey();
    log("loadData called, key=" + (apiKey ? ("len=" + apiKey.length) : "empty"));
    if (!apiKey) {
        showState("no-key-state");
        return;
    }

    showState("loading");
    const btn = document.getElementById("btn-refresh");
    if (btn) btn.disabled = true;

    try {
        const data = await requestAPI(apiKey);
        log("Data received, keys: " + Object.keys(data).join(","));

        const result = processData(data);
        if (!result) throw new Error("数据解析失败");

        document.getElementById("subtitle").textContent = result.subtitle;
        document.getElementById("product-count").textContent = result.activeProducts.length;
        document.getElementById("round-pill").textContent = "第 " + result.roundInfo.current + " / " + result.roundInfo.total + " 轮";
        document.getElementById("countdown-pill").textContent = result.roundInfo.countdown;

        renderProducts(result.activeProducts);
        renderHistory(result.historyGroups);

        showState("products-container");
        document.getElementById("history-section").style.display = result.historyGroups.length ? "block" : "none";
        document.getElementById("btn-refresh").style.display = "block";
        log("Render complete, active=" + result.activeProducts.length);
    } catch (err) {
        log("Error: " + err.message);
        document.getElementById("error-text").textContent = "加载失败：" + err.message;
        showState("error-state");
    } finally {
        if (btn) btn.disabled = false;
    }
}

function onSettingsChanged() {
    const key = getApiKey();
    if (key) loadData();
}

// Auto-load on start
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadData);
} else {
    loadData();
}
