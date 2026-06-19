const API_URL = "https://rocokingdomworld.org/data/merchant.json";
let _reqId = 0;
const _pending = {};

function log(msg) { console.log("[RocoMerchant] " + msg); }

function _nativeCallback(requestId, responseStr) {
    const p = _pending[requestId];
    if (!p) return;
    delete _pending[requestId];
    try {
        const resp = JSON.parse(responseStr);
        log("Callback received, status=" + resp.status);
        if (resp.error) {
            p.reject(new Error(resp.error));
        } else if (resp.status >= 200 && resp.status < 300) {
            log("Body keys=" + Object.keys(resp.body || {}).join(","));
            p.resolve(resp.body);
        } else {
            p.reject(new Error("HTTP " + resp.status));
        }
    } catch (e) {
        log("Callback error: " + e.message);
        p.reject(new Error("响应解析失败"));
    }
}

function showState(id) {
    ["loading", "error-state", "products-container", "history-section", "btn-refresh"]
        .forEach(s => {
            const el = document.getElementById(s === "loading" ? "loading" : s);
            if (el) el.style.display = "none";
        });
    const el = document.getElementById(id);
    if (el) el.style.display = id === "products-container" ? "flex" : "block";
}

function processData(data) {
    if (!data || !data.rounds) return null;

    const round = data.round || 1;
    const status = data.status || "open";
    const startedAt = data.startedAtBeijing || "";
    const nextRefresh = data.nextRefreshBeijing || "";

    const rounds = data.rounds || {};
    const currentRoundItems = rounds[String(round)] || data.items || [];

    const activeProducts = currentRoundItems.map(item => ({
        name: item.name || "未知商品",
        image: item.image || "",
        price: item.price || "",
        priceRaw: item.priceRaw || "",
        buyLimit: item.limit || "",
        category: item.category || "",
        description: item.description || ""
    }));

    const historyGroups = [];
    for (let i = 1; i <= 4; i++) {
        if (i !== round && rounds[String(i)]) {
            historyGroups.push({
                round: i,
                timeLabel: getTimeLabel(i),
                products: rounds[String(i)].map(item => ({
                    name: item.name || "未知商品",
                    image: item.image || "",
                    price: item.price || "",
                    priceRaw: item.priceRaw || "",
                    buyLimit: item.limit || "",
                    category: item.category || "",
                    description: item.description || ""
                }))
            });
        }
    }

    return {
        status: status,
        round: round,
        totalRounds: 4,
        startedAt: startedAt,
        nextRefresh: nextRefresh,
        countdown: calculateCountdown(nextRefresh),
        activeProducts: activeProducts,
        historyGroups: historyGroups
    };
}

function getTimeLabel(round) {
    const times = { 1: "08:00", 2: "12:00", 3: "16:00", 4: "20:00" };
    return times[round] || "";
}

function calculateCountdown(nextRefresh) {
    if (!nextRefresh) return "--:--";

    const now = new Date();
    const parts = nextRefresh.split(" ");
    if (parts.length < 2) return "--:--";

    const timeParts = parts[1].split(":");
    if (timeParts.length < 3) return "--:--";

    const target = new Date(now);
    target.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), parseInt(timeParts[2]));

    if (target <= now) {
        target.setDate(target.getDate() + 1);
    }

    const diff = target - now;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return String(hours).padStart(2, "0") + ":" +
        String(minutes).padStart(2, "0") + ":" +
        String(seconds).padStart(2, "0");
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

        let metaHtml = '<span class="tag">' + escHtml(p.category) + '</span>';
        if (p.priceRaw) metaHtml += '<span class="tag tag-price">' + escHtml(p.priceRaw) + ' 洛克贝</span>';
        if (p.buyLimit) metaHtml += '<span class="tag">限购' + escHtml(p.buyLimit) + '</span>';

        return '<div class="product-card">' +
            imgHtml +
            '<div class="product-info">' +
            '<div class="product-name">' + escHtml(p.name) + '</div>' +
            '<div class="product-meta">' + metaHtml + '</div>' +
            (p.description ? '<div class="product-desc">' + escHtml(p.description) + '</div>' : '') +
            '</div>' +
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
                '<div class="history-item-price">' + escHtml(p.priceRaw || p.price) + '</div>' +
                '</div>';
        }).join("");

        return '<div class="history-group">' +
            '<div class="history-group-header">' +
            '<span>第 ' + g.round + ' 轮</span>' +
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

function requestAPI() {
    return new Promise((resolve, reject) => {
        if (window.AndroidBridge && window.AndroidBridge.fetchApi) {
            const id = String(++_reqId);
            _pending[id] = { resolve, reject };
            log("Requesting via native bridge, id=" + id);
            try {
                window.AndroidBridge.fetchApi(id, API_URL, "");
            } catch (e) {
                delete _pending[id];
                reject(new Error("原生请求调用失败: " + e.message));
            }
            setTimeout(function () {
                if (_pending[id]) {
                    delete _pending[id];
                    reject(new Error("请求超时"));
                }
            }, 20000);
        } else {
            log("Requesting via XHR fallback");
            const xhr = new XMLHttpRequest();
            xhr.open("GET", API_URL, true);
            xhr.timeout = 15000;
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const json = JSON.parse(xhr.responseText);
                        resolve(json);
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
    log("loadData called");
    showState("loading");
    const btn = document.getElementById("btn-refresh");
    if (btn) btn.disabled = true;

    try {
        const data = await requestAPI();
        log("Data received, status=" + data.status + ", round=" + data.round);

        const result = processData(data);
        if (!result) throw new Error("数据解析失败");

        document.getElementById("subtitle").textContent = "每日 08:00 / 12:00 / 16:00 / 20:00 刷新";
        document.getElementById("product-count").textContent = result.activeProducts.length;
        document.getElementById("round-pill").textContent = "第 " + result.round + " / " + result.totalRounds + " 轮";
        document.getElementById("countdown-pill").textContent = result.countdown;

        if (result.status === "closed") {
            document.getElementById("error-text").textContent = "商人暂时离开（00:00-08:00）";
            showState("error-state");
            return;
        }

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

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadData);
} else {
    loadData();
}
