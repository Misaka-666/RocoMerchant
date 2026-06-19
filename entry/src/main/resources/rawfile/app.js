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

// Tab 切换 - Spring 动画增强版
function switchTab(tab) {
    var merchantPage = document.getElementById("page-merchant");
    var eggPage = document.getElementById("page-egg");
    var pokedexPage = document.getElementById("page-pokedex");
    var navItems = document.querySelectorAll(".nav-item");

    // 移除所有 active 类
    merchantPage.classList.remove("active");
    eggPage.classList.remove("active");
    pokedexPage.classList.remove("active");

    for (var i = 0; i < navItems.length; i++) {
        navItems[i].classList.remove("active");
    }

    // 使用 requestAnimationFrame 确保 CSS 过渡正确触发
    requestAnimationFrame(function() {
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
    });
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

        html += '<div class="pokedex-card" onclick="showPokedexDetail(' + i + ')">';
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

function showPokedexDetail(index) {
    if (!pokedexData || !pokedexData[index]) return;

    var s = pokedexData[index];
    var typeColor = TYPE_COLORS[s.type.split(" / ")[0]] || "#999";
    var typeName = TYPE_NAMES[s.type.split(" / ")[0]] || s.type;

    document.getElementById("detail-no").textContent = s.no;
    document.getElementById("detail-img").innerHTML = '<img src="https://rocokingdomworld.org' + s.pic + '" onerror="this.parentElement.innerHTML=\'?\'" alt="">';
    document.getElementById("detail-name").textContent = s.name;
    document.getElementById("detail-name-en").textContent = s.nameEn;
    document.getElementById("detail-type").innerHTML = '<span class="pokedex-card-type" style="background:' + typeColor + '">' + typeName + '</span>';
    document.getElementById("detail-stats").textContent = '种族值: ' + s.total;

    // 基础信息
    var infoHtml = '';
    infoHtml += '<div class="pokedex-detail-info-row"><span class="pokedex-detail-info-label">编号</span><span class="pokedex-detail-info-value">' + s.no + '</span></div>';
    infoHtml += '<div class="pokedex-detail-info-row"><span class="pokedex-detail-info-label">中文名</span><span class="pokedex-detail-info-value">' + s.name + '</span></div>';
    infoHtml += '<div class="pokedex-detail-info-row"><span class="pokedex-detail-info-label">英文名</span><span class="pokedex-detail-info-value">' + s.nameEn + '</span></div>';
    infoHtml += '<div class="pokedex-detail-info-row"><span class="pokedex-detail-info-label">属性</span><span class="pokedex-detail-info-value">' + s.type + '</span></div>';
    infoHtml += '<div class="pokedex-detail-info-row"><span class="pokedex-detail-info-label">种族值</span><span class="pokedex-detail-info-value">' + s.total + '</span></div>';
    infoHtml += '<div class="pokedex-detail-info-row"><span class="pokedex-detail-info-label">进化阶段</span><span class="pokedex-detail-info-value">' + s.formStage + '</span></div>';
    infoHtml += '<div class="pokedex-detail-info-row"><span class="pokedex-detail-info-label">形态类型</span><span class="pokedex-detail-info-value">' + s.formType + '</span></div>';
    infoHtml += '<div class="pokedex-detail-info-row"><span class="pokedex-detail-info-label">闪光</span><span class="pokedex-detail-info-value">' + s.shiny + '</span></div>';

    // 获取详情数据
    var detail = null;
    var slug = s.nameEn.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (typeof POKEDEX_DETAIL_DATA !== 'undefined' && POKEDEX_DETAIL_DATA[slug]) {
        detail = POKEDEX_DETAIL_DATA[slug];
    }

    // 添加详情信息
    if (detail) {
        if (detail.height) {
            infoHtml += '<div class="pokedex-detail-info-row"><span class="pokedex-detail-info-label">身高</span><span class="pokedex-detail-info-value">' + detail.height + '</span></div>';
        }
        if (detail.weight) {
            infoHtml += '<div class="pokedex-detail-info-row"><span class="pokedex-detail-info-label">体重</span><span class="pokedex-detail-info-value">' + detail.weight + '</span></div>';
        }
        if (detail.obtainMethod) {
            infoHtml += '<div class="pokedex-detail-info-row"><span class="pokedex-detail-info-label">获取方式</span><span class="pokedex-detail-info-value">' + detail.obtainMethod + '</span></div>';
        }
    }
    document.getElementById("detail-info").innerHTML = infoHtml;

    // 描述
    var descSection = document.getElementById("detail-desc-section");
    if (detail && detail.description) {
        descSection.style.display = "block";
        document.getElementById("detail-desc").textContent = detail.description;
    } else {
        descSection.style.display = "none";
    }

    // 特性
    var traitSection = document.getElementById("detail-trait-section");
    if (detail && detail.traitName) {
        traitSection.style.display = "block";
        var traitHtml = '<div class="pokedex-detail-trait-name">' + escHtml(detail.traitName) + '</div>';
        if (detail.traitDesc) {
            traitHtml += '<div class="pokedex-detail-trait-desc">' + escHtml(detail.traitDesc) + '</div>';
        }
        document.getElementById("detail-trait").innerHTML = traitHtml;
    } else {
        traitSection.style.display = "none";
    }

    // 种族值
    var statsSection = document.getElementById("detail-base-stats-section");
    if (detail && detail.stats && (detail.stats.hp > 0 || detail.stats.atk > 0)) {
        statsSection.style.display = "block";
        var maxStat = 255;
        var statsHtml = '';
        statsHtml += renderStatBar('HP', detail.stats.hp, '#86EFAC', maxStat);
        statsHtml += renderStatBar('ATK', detail.stats.atk, '#FDBA74', maxStat);
        statsHtml += renderStatBar('M.ATK', detail.stats.matk, '#C4B5FD', maxStat);
        statsHtml += renderStatBar('DEF', detail.stats.def, '#FCD34D', maxStat);
        statsHtml += renderStatBar('M.DEF', detail.stats.mdef, '#7DD3FC', maxStat);
        statsHtml += renderStatBar('SPD', detail.stats.spd, '#F472B6', maxStat);
        document.getElementById("detail-base-stats").innerHTML = statsHtml;
    } else {
        statsSection.style.display = "none";
    }

    // 属性克制
    var matchupsSection = document.getElementById("detail-matchups-section");
    if (detail && detail.matchups && (detail.matchups.strongTo.length > 0 || detail.matchups.weakTo.length > 0)) {
        matchupsSection.style.display = "block";
        var mHtml = '';
        if (detail.matchups.strongTo.length > 0) {
            mHtml += renderMatchupGroup('攻击 2 倍克制', detail.matchups.strongTo, 'strong');
        }
        if (detail.matchups.weakTo.length > 0) {
            mHtml += renderMatchupGroup('受到 2 倍克制', detail.matchups.weakTo, 'weak');
        }
        if (detail.matchups.resistFrom.length > 0) {
            mHtml += renderMatchupGroup('受到 0.5 倍伤害', detail.matchups.resistFrom, 'resist');
        }
        if (detail.matchups.weakFrom.length > 0) {
            mHtml += renderMatchupGroup('攻击 0.5 倍伤害', detail.matchups.weakFrom, 'weak');
        }
        document.getElementById("detail-matchups").innerHTML = mHtml;
    } else {
        matchupsSection.style.display = "none";
    }

    // 技能
    var skillsSection = document.getElementById("detail-skills-section");
    if (detail && detail.skills && detail.skills.length > 0) {
        skillsSection.style.display = "block";
        var sHtml = '<table class="skill-table">';
        sHtml += '<thead><tr><th>Lv</th><th>技能</th><th>属性</th><th>分类</th><th>威力</th><th>PP</th><th>效果</th></tr></thead>';
        sHtml += '<tbody>';
        for (var i = 0; i < detail.skills.length; i++) {
            var sk = detail.skills[i];
            var skTypeColor = TYPE_COLORS[sk.type] || '#999';
            var skTypeName = TYPE_NAMES[sk.type] || sk.type;
            sHtml += '<tr>';
            sHtml += '<td>' + sk.level + '</td>';
            sHtml += '<td><strong>' + escHtml(sk.name) + '</strong></td>';
            sHtml += '<td><span class="skill-type" style="background:' + skTypeColor + '">' + skTypeName + '</span></td>';
            sHtml += '<td class="skill-category">' + escHtml(sk.category) + '</td>';
            sHtml += '<td>' + (sk.power > 0 ? sk.power : '-') + '</td>';
            sHtml += '<td>' + sk.pp + '</td>';
            sHtml += '<td>' + escHtml(sk.effect) + '</td>';
            sHtml += '</tr>';
        }
        sHtml += '</tbody></table>';
        document.getElementById("detail-skills").innerHTML = sHtml;
    } else {
        skillsSection.style.display = "none";
    }

    document.getElementById("pokedex-detail").classList.add("visible");
    if (window.AndroidBridge && window.AndroidBridge.notifyDetailOpen) {
        window.AndroidBridge.notifyDetailOpen();
    }
}

function renderStatBar(label, value, color, max) {
    var percent = Math.min(100, (value / max) * 100);
    return '<div class="stat-bar-container">' +
        '<div class="stat-bar-label">' + label + '</div>' +
        '<div class="stat-bar-track"><div class="stat-bar-fill" style="width:' + percent + '%;background:' + color + '"></div></div>' +
        '<div class="stat-bar-value">' + value + '</div>' +
        '</div>';
}

function renderMatchupGroup(label, types, type) {
    var html = '<div class="matchup-group">';
    html += '<div class="matchup-label">' + label + '</div>';
    html += '<div class="matchup-types">';
    for (var i = 0; i < types.length; i++) {
        var t = types[i];
        var c = TYPE_COLORS[t] || '#999';
        var n = TYPE_NAMES[t] || t;
        html += '<span class="matchup-type" style="background:' + c + '">' + n + '</span>';
    }
    html += '</div></div>';
    return html;
}

function closePokedexDetail() {
    var detail = document.getElementById("pokedex-detail");
    if (detail) {
        detail.classList.remove("visible");
    }
    if (window.AndroidBridge && window.AndroidBridge.notifyDetailClose) {
        window.AndroidBridge.notifyDetailClose();
    }
}

function isDetailOpen() {
    var detail = document.getElementById("pokedex-detail");
    if (detail && detail.classList.contains("visible")) {
        return "true";
    }
    return "false";
}

// 绑定返回按钮事件
(function() {
    var backBtn = document.getElementById('btn-back-detail');
    if (backBtn) {
        backBtn.onclick = function(e) {
            closePokedexDetail();
            return false;
        };
    }
})();

// ============================================
// 动画增强功能 - Spring 动画版本
// ============================================

// 列表交错动画 - 使用 CSS 类
function animateListItems(container, selector) {
    var items = container.querySelectorAll(selector || '.product-card, .result-card, .history-item, .pokedex-card');
    items.forEach(function(item, index) {
        // 移除旧的动画类
        item.classList.remove('animate-in');
        // 设置交错延迟
        item.style.animationDelay = (index * 80) + 'ms';
        // 强制重绘以重启动画
        void item.offsetWidth;
        // 添加动画类
        item.classList.add('animate-in');
    });
}

// 数字滚动动画 - Spring 弹簧效果
function animateNumber(element, newValue) {
    if (!element) return;
    
    // 使用 CSS 动画类
    element.style.animation = 'none';
    element.textContent = newValue;
    void element.offsetWidth;
    element.style.animation = 'numberSpring 0.5s var(--ease-spring) forwards';
}

// 增强 renderProducts 函数，添加动画
var originalRenderProducts = renderProducts;
renderProducts = function(products) {
    originalRenderProducts(products);
    var container = document.getElementById("products-container");
    if (container) {
        setTimeout(function() {
            animateListItems(container, '.product-card');
        }, 50);
    }
};

// 增强 displayEggResults 函数，添加动画
var originalDisplayEggResults = displayEggResults;
displayEggResults = function(results) {
    originalDisplayEggResults(results);
    var resultList = document.getElementById("result-list");
    if (resultList) {
        setTimeout(function() {
            animateListItems(resultList, '.result-card');
        }, 50);
    }
};

// 增强 renderPokedex 函数，添加动画
var originalRenderPokedex = renderPokedex;
renderPokedex = function(data) {
    originalRenderPokedex(data);
    var grid = document.getElementById("pokedex-grid");
    if (grid) {
        setTimeout(function() {
            animateListItems(grid, '.pokedex-card');
        }, 50);
    }
};

// 增强 renderHistory 函数，添加动画
var originalRenderHistory = renderHistory;
renderHistory = function(groups) {
    originalRenderHistory(groups);
    var container = document.getElementById("history-container");
    if (container) {
        setTimeout(function() {
            animateListItems(container, '.history-item');
        }, 50);
    }
};

// 页面切换动画增强
var originalSwitchTab = switchTab;
switchTab = function(tab) {
    var currentPage = document.querySelector('.page-content.active');
    if (currentPage) {
        currentPage.style.opacity = '0';
        currentPage.style.transform = 'translateY(-8px)';
    }
    
    setTimeout(function() {
        originalSwitchTab(tab);
    }, 150);
};

// 倒计时更新动画
var lastCountdown = '';
setInterval(function() {
    var countdownEl = document.getElementById("countdown-pill");
    if (countdownEl) {
        var now = getCurrentBeijingTime();
        var newCountdown = getCountdown(now);
        if (newCountdown !== lastCountdown) {
            animateNumber(countdownEl, newCountdown);
            lastCountdown = newCountdown;
        }
    }
}, 1000);

// 触觉反馈（如果支持）
function hapticFeedback(type) {
    if (window.AndroidBridge && window.AndroidBridge.hapticFeedback) {
        window.AndroidBridge.hapticFeedback(type || 'light');
    }
}

// 为所有可点击元素添加触觉反馈
document.addEventListener('click', function(e) {
    var target = e.target.closest('[onclick], .nav-item, .type-btn, .pokedex-card, .product-card, .result-card, button');
    if (target) {
        hapticFeedback('light');
    }
});

// 懒加载图片（优化性能）
function lazyLoadImages() {
    var images = document.querySelectorAll('img[data-src]');
    var imageObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                var img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(function(img) {
        imageObserver.observe(img);
    });
}

// 页面加载完成后初始化懒加载
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', lazyLoadImages);
} else {
    lazyLoadImages();
}
