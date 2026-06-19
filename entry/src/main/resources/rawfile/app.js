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
        log("Callback status=" + resp.status);
        if (resp.error) {
            p.reject(new Error(resp.error));
        } else if (resp.status >= 200 && resp.status < 300) {
            p.resolve(resp.body);
        } else {
            p.reject(new Error("HTTP " + resp.status));
        }
    } catch (e) {
        log("Callback parse error: " + e.message);
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

function getCurrentBeijingTime() {
    var utc = Date.now() + new Date().getTimezoneOffset() * 60000;
    return new Date(utc + 8 * 3600000);
}

function getCurrentRound(now) {
    var h = now.getHours();
    var m = now.getMinutes();
    var totalMin = h * 60 + m;

    if (totalMin < 480) return { round: 0, closed: true };
    if (totalMin < 720) return { round: 1, closed: false };
    if (totalMin < 960) return { round: 2, closed: false };
    if (totalMin < 1200) return { round: 3, closed: false };
    return { round: 4, closed: false };
}

function getCountdown(now) {
    var h = now.getHours();
    var m = now.getMinutes();
    var s = now.getSeconds();
    var totalMin = h * 60 + m;

    var targets = [480, 720, 960, 1200];
    for (var i = 0; i < targets.length; i++) {
        if (totalMin < targets[i]) {
            var remain = targets[i] - totalMin - 1;
            var remainS = 60 - s;
            var rh = Math.floor(remain / 60);
            var rm = remain % 60;
            return String(rh).padStart(2, "0") + ":" + String(rm).padStart(2, "0") + ":" + String(remainS).padStart(2, "0");
        }
    }
    return "明日 08:00";
}

function processData(data) {
    if (!data || !data.rounds) return null;

    var now = getCurrentBeijingTime();
    var roundInfo = getCurrentRound(now);
    var round = roundInfo.round;
    var closed = roundInfo.closed;

    var rounds = data.rounds || {};
    var currentRoundItems = rounds[String(round)] || [];

    var activeProducts = currentRoundItems.map(function(item) {
        return {
            name: item.name || "未知商品",
            image: item.image || "",
            price: item.price || "",
            priceRaw: item.priceRaw || "",
            buyLimit: item.limit || "",
            category: item.category || "",
            description: item.description || ""
        };
    });

    var historyGroups = [];
    for (var i = 1; i < round; i++) {
        if (rounds[String(i)]) {
            historyGroups.push({
                round: i,
                timeLabel: getTimeLabel(i),
                products: rounds[String(i)].map(function(item) {
                    return {
                        name: item.name || "未知商品",
                        image: item.image || "",
                        price: item.price || "",
                        priceRaw: item.priceRaw || "",
                        buyLimit: item.limit || "",
                        category: item.category || "",
                        description: item.description || ""
                    };
                })
            });
        }
    }

    return {
        status: closed ? "closed" : "open",
        round: round || 1,
        totalRounds: 4,
        countdown: getCountdown(now),
        activeProducts: activeProducts,
        historyGroups: historyGroups
    };
}

function getTimeLabel(round) {
    var times = { 1: "08:00-12:00", 2: "12:00-16:00", 3: "16:00-20:00", 4: "20:00-24:00" };
    return times[round] || "";
}

function renderProducts(products) {
    var container = document.getElementById("products-container");
    if (!products.length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-2);padding:24px">当前轮次暂无在售商品</div>';
        return;
    }

    container.innerHTML = products.map(function(p) {
        var imgHtml = p.image
            ? '<div class="product-image"><img src="' + p.image + '" onerror="this.parentElement.innerHTML=\'🛒\'" alt=""></div>'
            : '<div class="product-image">🛒</div>';

        var metaHtml = '<span class="tag">' + escHtml(p.category) + '</span>';
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
    var section = document.getElementById("history-section");
    var container = document.getElementById("history-container");

    if (!groups.length) {
        section.style.display = "none";
        return;
    }

    section.style.display = "block";
    container.innerHTML = groups.map(function(g) {
        var items = g.products.map(function(p) {
            var img = p.image
                ? '<div class="history-item-icon"><img src="' + p.image + '" onerror="this.style.display=\'none\'" alt=""></div>'
                : '';
            return '<div class="history-item">' + img +
                '<div class="history-item-name">' + escHtml(p.name) + '</div>' +
                '<div class="history-item-price">' + escHtml(p.priceRaw || p.price) + '</div>' +
                '</div>';
        }).join("");

        return '<div class="history-group">' +
            '<div class="history-group-header">' +
            '<span>第 ' + g.round + ' 轮</span> ' +
            escHtml(g.timeLabel) +
            '</div>' +
            '<div class="history-products">' + items + '</div>' +
            '</div>';
    }).join("");
}

function escHtml(str) {
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

function requestAPI() {
    return new Promise(function(resolve, reject) {
        if (window.AndroidBridge && window.AndroidBridge.fetchApi) {
            var id = String(++_reqId);
            _pending[id] = { resolve: resolve, reject: reject };
            log("Requesting via native bridge, id=" + id);
            try {
                window.AndroidBridge.fetchApi(id, API_URL, "");
            } catch (e) {
                delete _pending[id];
                reject(new Error("原生请求调用失败: " + e.message));
            }
            setTimeout(function() {
                if (_pending[id]) {
                    delete _pending[id];
                    reject(new Error("请求超时"));
                }
            }, 20000);
        } else {
            log("Requesting via XHR fallback");
            var xhr = new XMLHttpRequest();
            xhr.open("GET", API_URL, true);
            xhr.timeout = 15000;
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch (e) { reject(new Error("JSON 解析失败")); }
                } else { reject(new Error("HTTP " + xhr.status)); }
            };
            xhr.onerror = function() { reject(new Error("网络请求失败")); };
            xhr.ontimeout = function() { reject(new Error("请求超时")); };
            xhr.send();
        }
    });
}

async function loadData() {
    log("loadData called");
    showState("loading");
    var btn = document.getElementById("btn-refresh");
    if (btn) btn.disabled = true;

    try {
        var data = await requestAPI();
        log("Data received, rounds keys=" + Object.keys(data.rounds || {}).join(","));

        var result = processData(data);
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
        log("Render complete, round=" + result.round + ", active=" + result.activeProducts.length);
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

// Tab 切换
function switchTab(tab) {
    var merchantPage = document.getElementById("page-merchant");
    var eggPage = document.getElementById("page-egg");
    var pokedexPage = document.getElementById("page-pokedex");
    var navItems = document.querySelectorAll(".nav-item");

    merchantPage.classList.remove("active");
    eggPage.classList.remove("active");
    pokedexPage.classList.remove("active");

    for (var i = 0; i < navItems.length; i++) {
        navItems[i].classList.remove("active");
    }

    if (tab === "merchant") {
        merchantPage.classList.add("active");
        navItems[0].classList.add("active");
    } else if (tab === "egg") {
        eggPage.classList.add("active");
        navItems[1].classList.add("active");
    } else if (tab === "pokedex") {
        pokedexPage.classList.add("active");
        navItems[2].classList.add("active");
        initPokedex();
    }
}

// 孵蛋鉴定功能
var eggData = null;
var EGG_DATA_URL = "https://raw.githubusercontent.com/Misaka-666/RocoMerchant/master/egg-data-versioned.json";

function loadEggDataNative() {
    log("Loading egg data");

    // 1. 先使用嵌入的默认数据
    if (typeof EGG_SIZES_DATA !== 'undefined') {
        eggData = EGG_SIZES_DATA;
        log("Loaded " + eggData.length + " entries from embedded data");
    }

    // 2. 检查本地缓存
    try {
        var cached = localStorage.getItem('egg_data_cache');
        if (cached) {
            var cacheObj = JSON.parse(cached);
            if (cacheObj.items && cacheObj.items.length > 0) {
                eggData = cacheObj.items;
                log("Loaded " + eggData.length + " entries from cache, version=" + cacheObj.version);
            }
        }
    } catch (e) {
        log("Cache load error: " + e.message);
    }

    // 3. 从网络获取最新数据
    fetchRemoteEggData();
}

function fetchRemoteEggData() {
    if (window.AndroidBridge && window.AndroidBridge.fetchApi) {
        var id = String(++_reqId);
        _pending[id] = {
            resolve: function(data) {
                if (data && data.items && data.items.length > 0) {
                    eggData = data.items;
                    log("Updated from remote, " + eggData.length + " entries, version=" + data.version);
                    try {
                        localStorage.setItem('egg_data_cache', JSON.stringify(data));
                    } catch (e) {
                        log("Cache save error: " + e.message);
                    }
                }
            },
            reject: function(err) {
                log("Remote fetch failed, using cached/embedded data");
            }
        };
        try {
            window.AndroidBridge.fetchApi(id, EGG_DATA_URL, "");
        } catch (e) {
            delete _pending[id];
            log("Remote fetch error: " + e.message);
        }
    }
}

function searchEggs() {
    var heightInput = document.getElementById("input-height").value;
    var weightInput = document.getElementById("input-weight").value;

    var height = heightInput ? parseFloat(heightInput) : null;
    var weight = weightInput ? parseFloat(weightInput) : null;

    if (height === null && weight === null) {
        return;
    }

    if (!eggData) {
        return;
    }

    var results = matchEggs(height, weight);
    displayEggResults(results);
}

function matchEggs(height, weight) {
    var matches = [];

    for (var i = 0; i < eggData.length; i++) {
        var entry = eggData[i];
        var heightMatch = true;
        var weightMatch = true;

        if (height !== null) {
            heightMatch = height >= entry.heightMin && height <= entry.heightMax;
        }
        if (weight !== null) {
            weightMatch = weight >= entry.weightMin && weight <= entry.weightMax;
        }

        if (heightMatch && weightMatch) {
            var confidence = (height !== null && weight !== null) ? "high" : "medium";
            var bodyType = height !== null ? getBodyType(height, entry.heightMin, entry.heightMax) : "";

            matches.push({
                name: entry.name,
                nameEn: entry.nameEn,
                pic: entry.pic,
                heightMin: entry.heightMin,
                heightMax: entry.heightMax,
                weightMin: entry.weightMin,
                weightMax: entry.weightMax,
                confidence: confidence,
                bodyType: bodyType
            });
        }
    }

    matches.sort(function(a, b) {
        if (a.confidence === "high" && b.confidence !== "high") return -1;
        if (a.confidence !== "high" && b.confidence === "high") return 1;
        return 0;
    });

    return matches;
}

function getBodyType(value, min, max) {
    if (min === max) return "标准体型";
    var position = (value - min) / (max - min);
    if (position < -0.1) return "迷你小不点";
    if (position < 0.15) return "小不点";
    if (position < 0.35) return "偏小型";
    if (position <= 0.65) return "标准体型";
    if (position <= 0.85) return "偏大型";
    if (position <= 1.1) return "大块头";
    return "巨型大块头";
}

function displayEggResults(results) {
    var resultSection = document.getElementById("result-section");
    var emptyState = document.getElementById("empty-state");
    var initialState = document.getElementById("initial-state");
    var resultList = document.getElementById("result-list");
    var resultCount = document.getElementById("result-count");

    initialState.style.display = "none";

    if (results.length === 0) {
        resultSection.style.display = "none";
        emptyState.style.display = "block";
        return;
    }

    emptyState.style.display = "none";
    resultSection.style.display = "block";
    resultCount.textContent = results.length;

    var html = "";
    for (var i = 0; i < results.length; i++) {
        var r = results[i];
        var confidenceClass = r.confidence === "high" ? "confidence-high" : "confidence-medium";
        var confidenceText = r.confidence === "high" ? "高置信" : "可能匹配";

        html += '<div class="result-card">';
        html += '  <div class="result-image"><img src="https://rocokingdomworld.org' + r.pic + '" onerror="this.parentElement.innerHTML=\'🥚\'" alt=""></div>';
        html += '  <div class="result-info">';
        html += '    <div class="result-name">' + escHtml(r.name) + '</div>';
        html += '    <div class="result-name-en">' + escHtml(r.nameEn) + '</div>';
        html += '    <div class="result-tags">';
        html += '      <span class="tag ' + confidenceClass + '">' + confidenceText + '</span>';
        if (r.bodyType) {
            html += '      <span class="tag">' + escHtml(r.bodyType) + '</span>';
        }
        html += '    </div>';
        html += '    <div class="result-range">';
        html += '      <div>蛋身高: ' + r.heightMin + ' - ' + r.heightMax + ' m</div>';
        html += '      <div>蛋体重: ' + r.weightMin + ' - ' + r.weightMax + ' kg</div>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
    }

    resultList.innerHTML = html;
}

loadEggDataNative();

// 精灵图鉴功能
var pokedexData = null;
var pokedexInitialized = false;
var selectedType = "";

var TYPE_COLORS = {
    "Normal": "#A8A878", "Grass": "#78C850", "Fire": "#F08030", "Water": "#6890F0",
    "Light": "#F8D030", "Ground": "#E0C068", "Ice": "#98D8D8", "Dragon": "#7038F8",
    "Electric": "#F8D030", "Poison": "#A040A0", "Bug": "#A8B820", "Fighting": "#C03028",
    "Flying": "#A890F0", "Fairy": "#EE99AC", "Ghost": "#705898", "Dark": "#705848",
    "Steel": "#B8B8D0", "Psychic": "#F85888"
};

var TYPE_NAMES = {
    "Normal": "普通", "Grass": "草", "Fire": "火", "Water": "水",
    "Light": "光", "Ground": "地", "Ice": "冰", "Dragon": "龙",
    "Electric": "电", "Poison": "毒", "Bug": "虫", "Fighting": "武",
    "Flying": "翼", "Fairy": "萌", "Ghost": "幽", "Dark": "恶",
    "Steel": "机械", "Psychic": "幻"
};

function initPokedex() {
    if (pokedexInitialized) return;
    pokedexInitialized = true;

    if (typeof POKEDEX_DATA !== 'undefined') {
        pokedexData = POKEDEX_DATA;
        log("Loaded " + pokedexData.length + " pokedex entries");
        document.getElementById("pokedex-total").textContent = pokedexData.length;
        renderTypeFilters();
        renderPokedex(pokedexData);
    }
}

function renderTypeFilters() {
    var container = document.getElementById("type-filters");
    var types = Object.keys(TYPE_COLORS);
    var html = '<div class="type-btn" onclick="selectType(\"\")" id="type-all">全部</div>';

    for (var i = 0; i < types.length; i++) {
        var type = types[i];
        html += '<div class="type-btn" id="type-' + type + '" onclick="selectType(\'' + type + '\')" ';
        html += 'style="border-color:' + TYPE_COLORS[type] + '">' + TYPE_NAMES[type] + '</div>';
    }

    container.innerHTML = html;
}

function selectType(type) {
    selectedType = type;

    var allBtns = document.querySelectorAll(".type-btn");
    for (var i = 0; i < allBtns.length; i++) {
        allBtns[i].classList.remove("active");
        allBtns[i].style.background = "";
    }

    if (type === "") {
        document.getElementById("type-all").classList.add("active");
        document.getElementById("type-all").style.background = "#a0631d";
    } else {
        var btn = document.getElementById("type-" + type);
        if (btn) {
            btn.classList.add("active");
            btn.style.background = TYPE_COLORS[type];
        }
    }

    filterPokedex();
}

function filterPokedex() {
    if (!pokedexData) return;

    var searchText = document.getElementById("pokedex-search-input").value.toLowerCase();
    var sortBy = document.getElementById("pokedex-sort").value;

    var filtered = pokedexData.filter(function(s) {
        if (selectedType && s.type.indexOf(selectedType) === -1) return false;
        if (searchText) {
            var match = s.name.toLowerCase().indexOf(searchText) >= 0 ||
                       s.nameEn.toLowerCase().indexOf(searchText) >= 0 ||
                       s.no.toLowerCase().indexOf(searchText) >= 0;
            if (!match) return false;
        }
        return true;
    });

    filtered.sort(function(a, b) {
        if (sortBy === "no-asc") return a.no.localeCompare(b.no);
        if (sortBy === "no-desc") return b.no.localeCompare(a.no);
        if (sortBy === "total-desc") return b.total - a.total;
        if (sortBy === "total-asc") return a.total - b.total;
        if (sortBy === "name-asc") return a.name.localeCompare(b.name);
        return 0;
    });

    renderPokedex(filtered);
}

function renderPokedex(data) {
    var grid = document.getElementById("pokedex-grid");
    var empty = document.getElementById("pokedex-empty");

    if (data.length === 0) {
        grid.style.display = "none";
        empty.style.display = "block";
        return;
    }

    empty.style.display = "none";
    grid.style.display = "grid";

    var html = "";
    for (var i = 0; i < data.length; i++) {
        var s = data[i];
        var typeColor = TYPE_COLORS[s.type.split(" / ")[0]] || "#999";
        var typeName = TYPE_NAMES[s.type.split(" / ")[0]] || s.type;

        html += '<div class="pokedex-card">';
        html += '  <div class="pokedex-card-no">' + escHtml(s.no) + '</div>';
        html += '  <div class="pokedex-card-img"><img src="https://rocokingdomworld.org' + s.pic + '" onerror="this.parentElement.innerHTML=\'?\'" alt=""></div>';
        html += '  <div class="pokedex-card-name">' + escHtml(s.name) + '</div>';
        html += '  <div class="pokedex-card-name-en">' + escHtml(s.nameEn) + '</div>';
        html += '  <div class="pokedex-card-type" style="background:' + typeColor + '">' + typeName + '</div>';
        html += '  <div class="pokedex-card-stats">种族值: ' + s.total + '</div>';
        html += '</div>';
    }

    grid.innerHTML = html;
}
