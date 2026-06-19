var sizesData = null;

function log(msg) { console.log("[EggIdentifier] " + msg); }

function loadData() {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "egg-data.json", true);
    xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
            sizesData = JSON.parse(xhr.responseText);
            log("Loaded " + sizesData.length + " egg size entries");
        } else {
            log("Failed to load egg data: HTTP " + xhr.status);
        }
    };
    xhr.onerror = function() { log("Failed to load egg data"); };
    xhr.send();
}

function searchEggs() {
    var heightInput = document.getElementById("input-height").value;
    var weightInput = document.getElementById("input-weight").value;

    var height = heightInput ? parseFloat(heightInput) : null;
    var weight = weightInput ? parseFloat(weightInput) : null;

    if (height === null && weight === null) {
        alert("请输入蛋的身高或体重");
        return;
    }

    if (!sizesData) {
        alert("数据加载中，请稍后再试");
        return;
    }

    var results = matchEggs(height, weight);
    displayResults(results);
}

function matchEggs(height, weight) {
    var matches = [];

    for (var i = 0; i < sizesData.length; i++) {
        var entry = sizesData[i];
        var heightMatch = true;
        var weightMatch = true;

        if (height !== null) {
            heightMatch = height >= entry.heightMin && height <= entry.heightMax;
        }
        if (weight !== null) {
            weightMatch = weight >= entry.weightMin && weight <= entry.weightMax;
        }

        if (heightMatch && weightMatch) {
            var confidence = "low";
            if (height !== null && weight !== null) {
                confidence = "high";
            } else {
                confidence = "medium";
            }

            var bodyType = "";
            if (height !== null) {
                bodyType = getBodyType(height, entry.heightMin, entry.heightMax);
            }

            matches.push({
                name: entry.name,
                nameEn: entry.nameEn,
                pic: entry.pic,
                heightMin: entry.heightMin,
                heightMax: entry.heightMax,
                weightMin: entry.weightMin,
                weightMax: entry.weightMax,
                confidence: confidence,
                bodyType: bodyType,
                matchMethod: entry.matchMethod
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

function displayResults(results) {
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

function escHtml(str) {
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
}

function goBack() {
    if (window.AndroidBridge && window.AndroidBridge.goBack) {
        window.AndroidBridge.goBack();
    } else {
        window.history.back();
    }
}

loadData();
