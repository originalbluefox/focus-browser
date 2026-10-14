let config = {
    multiplier: 100,
    temperature: .38,
    levenmultiplier: 100,
    dev: false
};

const backupListLinks = [
    "example.com",
    "google.com",
    "bing.com",
    "yahoo.com",
    "duckduckgo.com"
];

const backupListQueries = [
    "google",
    "bing",
    "yahoo",
    "duckduckgo"
];

const levenshteinDistance = function (s1a, s2) {
    let result = 0;
    let s1b = s1a.split(" ");
    if (s1b.includes(s2)) return -10000;

    for (const s1 of s1b) {
        if (s1.length === 0) return s2.length;
        if (s2.length === 0) return s1.length;

        const matrix = [];
        for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
        for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= s2.length; i++) {
            for (let j = 1; j <= s1.length; j++) {
                const substitutionCost = s1[j - 1] === s2[i - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + substitutionCost
                );
            }
        }
        result += matrix[s2.length][s1.length];
    }
    let s2seperate = s2.split("");
    return result / s2seperate.length;
};

const getProhibitedLinksOrDomains = async function () {
    try {
        const response = await fetch(
            "https://raw.githubusercontent.com/originalbluef3x/focus-helper/refs/heads/main/blockedLinks.json",
            { method: "GET" }
        );
        return await response.json();
    } catch (e) {
        return Array.from(backupListLinks);
    }
};

const getProhibitedQueriesOrEnteries = async function () {
    try {
        const response = await fetch(
            "https://raw.githubusercontent.com/originalbluef3x/focus-helper/refs/heads/main/blockedQueries.json",
            { method: "GET" }
        );
        const data = await response.json();
        return Array.from(data || backupListQueries);
    } catch (e) {
        return Array.from(backupListQueries);
    }
};

const checkSearch = async function (input) {
    const tld = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;
    let isTLD = tld.test(input);
    let isLinkRegex = /\w+:\/\//;
    let isLink = isLinkRegex.test(input);

    if (isTLD || isLink) {
        let latestList = await getProhibitedLinksOrDomains();
        if (!Array.isArray(latestList) || latestList.length <= 0) return false;
        let URLinput = !isTLD && isLink ? new URL(input).host : input;
        return latestList.includes(URLinput) ? false : input;
    } else {
        let latestList = await getProhibitedQueriesOrEnteries();
        if (latestList.length <= 0) return false;
        const matches = latestList.filter(v => input == v || (levenshteinDistance(input, v) < config.temperature));
        return matches.length > 0 ? false : input;
    }
};

const getConfig = async function () {
    if (config.dev) return config;
    try {
        const res = await fetch("https://raw.githubusercontent.com/originalbluef3x/focus-helper/refs/heads/main/config.json");
        const responseData = await res.json();
        config = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
    } catch {
        return false;
    }
};

module.exports = {
    checkSearch,
    getConfig
};